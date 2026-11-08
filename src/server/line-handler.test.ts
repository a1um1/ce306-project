import assert from "node:assert/strict";
import test from "node:test";

// line-handler.ts imports @/db, which opens a client at import. Give it a dummy
// URL first — like app.test.ts — so the module loads without a live Postgres.
// No test below runs a query: tools are injected as fakes.
process.env.DATABASE_URL ??= "postgres://paytail:paytail@localhost:5432/paytail";
process.env.APP_TIMEZONE = "Asia/Bangkok";

const { processLineEvent } = await import("./line-handler");
import type { Step } from "./line-handler";
import type { LineMessage } from "./line-client";

class FakeClient {
  replies: { token: string; text: string }[] = [];
  async replyMessage(token: string, messages: LineMessage[]): Promise<boolean> {
    this.replies.push({ token, text: messages[0].type === "text" ? messages[0].text : "" });
    return true;
  }
}

const textEvent = (text: string, userId = "U1", replyToken = "token") => ({
  id: `evt-${Math.random()}`,
  type: "message" as const,
  source: { userId },
  replyToken,
  message: { id: `m-${Math.random()}`, type: "text", text },
});

test("ignores non-text and non-message events", async () => {
  const client = new FakeClient();
  const callModel = async () => ({ tool: "", args: "", reply: "ไม่ควรถูกเรียก" });
  await processLineEvent({ id: "x", type: "message", replyToken: "t", source: { userId: "U1" }, message: { id: "m", type: "image" } }, { client, callModel });
  await processLineEvent({ id: "x2", type: "follow", replyToken: "t", source: { userId: "U1" } }, { client, callModel });
  await processLineEvent({ id: "x3", type: "message", replyToken: "", source: { userId: "U1" }, message: { id: "m", type: "text", text: "hi" } }, { client, callModel });
  assert.equal(client.replies.length, 0);
});

test("unmapped line user gets the not-linked notice, model untouched", async () => {
  const client = new FakeClient();
  const callModel = async () => { throw new Error("must not be called") };
  await processLineEvent(textEvent("ปลาทู 40"), { client, callModel, userIdFor: () => null });
  assert.equal(client.replies.length, 1);
  assert.match(client.replies[0].text, /ยังไม่ได้เชื่อมต่อ/);
});

test("single final reply without a tool call", async () => {
  const client = new FakeClient();
  const callModel = async () => ({ tool: "", args: "", reply: "สวัสดีครับ จะจดอะไรดีล่ะ" });
  const runTool = async () => { throw new Error("must not be called") };
  await processLineEvent(textEvent("สวัสดี"), { client, callModel, runTool, userIdFor: () => "u1" });
  assert.equal(client.replies.length, 1);
  assert.equal(client.replies[0].text, "สวัสดีครับ จะจดอะไรดีล่ะ");
});

test("tool result is fed back so the model can answer with it", async () => {
  const client = new FakeClient();
  const calls: { date: string; history: string }[] = [];
  const callModel = async (date: string, history: string): Promise<Step> => {
    calls.push({ date, history });
    if (calls.length === 1) return { tool: "query_expenses", args: '{"date_from":"2026-11-01","date_to":"2026-11-08"}', reply: "" };
    return { tool: "", args: "", reply: "สัปดาห์นี้ใช้ไป 1,200 บาทครับ" };
  };
  const runTool = async (tool: string, argsJson: string) => {
    assert.equal(tool, "query_expenses");
    return `spent 1200, 3 entries; top: ปลาทู 400, ข้าว 350, กาแฟ 300`;
  };
  await processLineEvent(textEvent("สัปดาห์นี้ใช้เงินไปเท่าไหร่"), { client, callModel, runTool, userIdFor: () => "u1" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].history, /สัปดาห์นี้ใช้เงินไปเท่าไหร่/);
  assert.match(calls[1].history, /result: spent 1200/);
  assert.equal(client.replies[0].text, "สัปดาห์นี้ใช้ไป 1,200 บาทครับ");
});

test("tool ERROR is fed back to the model for self-correction, no apology", async () => {
  const client = new FakeClient();
  const histories: string[] = [];
  const callModel = async (date: string, history: string): Promise<Step> => {
    histories.push(history);
    if (histories.length === 1) {
      return { tool: "add_expense", args: '{"items":[{"amount":40,"note":"ปลาทู"}]}', reply: "" };
    }
    return { tool: "", args: "", reply: "จดให้แล้วครับ" };
  };
  let calls = 0;
  const runTool = async () => {
    calls++;
    return "ERROR: each item needs a positive number amount";
  };
  await processLineEvent(textEvent("ปลาทู"), { client, callModel, runTool, userIdFor: () => "u1" });
  assert.equal(calls, 1);
  assert.match(histories[0], /user: ปลาทู/);
  assert.match(histories[1], /result: ERROR: each item needs a positive number amount/);
  assert.equal(client.replies[0].text, "จดให้แล้วครับ", "error goes back to the model, not to the user");
});

test("loop caps at MAX_TOOL_CALLS (=3) then forces a final reply", async () => {
  const client = new FakeClient();
  let calls = 0;
  const callModel = async (): Promise<Step> => {
    calls++;
    return { tool: "query_expenses", args: "{}", reply: "" };
  };
  const runTool = async () => "OK: fine";
  await processLineEvent(textEvent("ย้ำ"), { client, callModel, runTool, userIdFor: () => "u1" });
  assert.equal(calls, 4, "three tool turns, then one forced non-tool step");
  assert.equal(client.replies.length, 1);
});

test("model/client crash replies with the apology, not a direct throw", async () => {
  const client = new FakeClient();
  const callModel = async () => { throw new Error("line-nlu down") };
  await processLineEvent(textEvent("ปลาทู 40"), { client, callModel, userIdFor: () => "u1" });
  assert.equal(client.replies.length, 1);
  assert.equal(client.replies[0].text, "จดไม่สำเร็จ ลองใหม่นะ");
});
