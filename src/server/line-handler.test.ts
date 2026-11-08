import assert from "node:assert/strict";
import test from "node:test";

// line-handler.ts imports @/db, which opens a client at import. Give it a dummy
// URL first — like app.test.ts — so the module loads without a live Postgres.
// No test below runs a query: tools are injected as fakes, and add rows have no
// category so buildRows never queries.
process.env.DATABASE_URL ??= "postgres://paytail:paytail@localhost:5432/paytail";
process.env.APP_TIMEZONE = "Asia/Bangkok";

const mod = await import("./line-handler");
const { processLineEvent } = mod;
import type { Step, ExpenseRow, PendingMemo } from "./line-handler";
import type { LineMessage } from "./line-client";

class FakeClient {
  replies: { token: string; messages: LineMessage[] }[] = [];
  pushes: { to: string; messages: LineMessage[] }[] = [];
  async replyMessage(token: string, messages: LineMessage[]): Promise<boolean> {
    this.replies.push({ token, messages });
    return true;
  }
  async pushMessage(to: string, messages: LineMessage[]): Promise<boolean> {
    this.pushes.push({ to, messages });
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

const postbackEvent = (data: string, userId = "U1") => ({
  id: `evt-${Math.random()}`,
  type: "postback" as const,
  source: { userId },
  replyToken: "postback-token",
  postback: { data },
});

// Capture any pushed or replied message's visible text (flex header or plain).
const firstText = (msg: LineMessage) => {
  if (msg.type === "text") return msg.text;
  const header = (msg.contents as { header?: { contents?: { text?: string }[] } })?.header?.contents;
  return header?.[0]?.text ?? "";
};

test("ignores non-text and non-message events", async () => {
  const client = new FakeClient();
  const callModel = async () => ({ tool: "", args: "", reply: "ไม่ควรถูกเรียก" });
  await processLineEvent({ id: "x", type: "message", replyToken: "t", source: { userId: "U1" }, message: { id: "m", type: "image" } }, { client, callModel });
  await processLineEvent({ id: "x2", type: "follow", replyToken: "t", source: { userId: "U1" } }, { client, callModel });
  await processLineEvent({ id: "x3", type: "message", replyToken: "", source: { userId: "U1" }, message: { id: "m", type: "text", text: "hi" } }, { client, callModel });
  assert.equal(client.replies.length + client.pushes.length, 0);
});

test("unmapped line user gets an ack then the not-linked notice, model untouched", async () => {
  const client = new FakeClient();
  const callModel = async () => { throw new Error("must not be called") };
  await processLineEvent(textEvent("ปลาทู 40"), { client, callModel, userIdFor: () => null });
  // A processing-ack flex is replied first, then the not-linked push.
  assert.equal(client.replies.length, 1);
  assert.equal(client.replies[0].messages[0].type, "flex");
  assert.equal(client.pushes.length, 1);
  assert.match(firstText(client.pushes[0].messages[0]), /เชื่อมต่อ/);
});

test("single final reply without a tool call is pushed after an ack flex", async () => {
  const client = new FakeClient();
  const callModel = async () => ({ tool: "", args: "", reply: "สวัสดีครับ จะจดอะไรดีล่ะ" });
  const runTool = async () => { throw new Error("must not be called") };
  await processLineEvent(textEvent("สวัสดี"), { client, callModel, runTool, userIdFor: () => "u1" });
  assert.equal(client.replies.length, 1, "processing ack flex replied first");
  assert.equal(client.replies[0].messages[0].type, "flex");
  assert.match(JSON.stringify(client.replies[0].messages[0]), /กำลังอ่านเมมโม่/);
  assert.equal(client.pushes.length, 1);
  assert.equal(firstText(client.pushes[0].messages[0]), "สวัสดีครับ จะจดอะไรดีล่ะ");
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
  assert.equal(firstText(client.pushes[0].messages[0]), "สัปดาห์นี้ใช้ไป 1,200 บาทครับ");
});

test("add_expense ERROR is fed back to the model for self-correction", async () => {
  const client = new FakeClient();
  const histories: string[] = [];
  const callModel = async (date: string, history: string): Promise<Step> => {
    histories.push(history);
    if (histories.length === 1) {
      // amount 0 fails validation -> the error must go back, not to the user.
      return { tool: "add_expense", args: '{"items":[{"amount":0,"note":"ปลาทู"}]}', reply: "" };
    }
    return { tool: "", args: "", reply: "จดให้แล้วครับ" };
  };
  const insertRows = async () => { throw new Error("must not be called"); };
  await processLineEvent(textEvent("ปลาทู"), { client, callModel, insertRows, userIdFor: () => "u1" });
  assert.match(histories[0], /user: ปลาทู/);
  assert.match(histories[1], /result: ERROR: each item needs a positive number amount/);
  assert.equal(client.pushes.length, 1);
  assert.equal(firstText(client.pushes[0].messages[0]), "จดให้แล้วครับ", "error goes back to the model, not to the user");
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
  assert.equal(client.pushes.length, 1);
});

test("model/client crash pushes the apology with the reason, not a direct throw", async () => {
  const client = new FakeClient();
  const callModel = async () => { throw new Error("line-nlu down") };
  await processLineEvent(textEvent("ปลาทู 40"), { client, callModel, userIdFor: () => "u1" });
  assert.equal(client.pushes.length, 1);
  assert.match(firstText(client.pushes[0].messages[0]), /จดไม่สำเร็จ/);
  assert.match(firstText(client.pushes[0].messages[0]), /line-nlu down/, "the failure cause is shown");
});

// --- add_expense: auto-save single, confirm flex for a multi-item memo ---

test("single-item add auto-saves, pushes confirmation, no flex", async () => {
  const client = new FakeClient();
  const saved: ExpenseRow[][] = [];
  const insertRows = async (rows: ExpenseRow[]) => {
    saved.push(rows);
    return rows.map((r) => ({ title: r.title, amount: r.amount }));
  };
  const callModel = async () => ({ tool: "add_expense", args: '{"items":[{"amount":40,"note":"ปลาทู"}]}', reply: "" });
  const runTool = async () => { throw new Error("must not be called") };
  await processLineEvent(textEvent("ปลาทู 40"), { client, callModel, runTool, insertRows, userIdFor: () => "u1" });
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0].title, "ปลาทู");
  assert.equal(client.replies.length, 1, "processing ack flex only");
  assert.equal(client.pushes.length, 1);
  assert.match(firstText(client.pushes[0].messages[0]), /บันทึกแล้วครับ/);
});

test("multi-item memo pushes a flex confirm and saves nothing yet", async () => {
  const client = new FakeClient();
  const saved: ExpenseRow[][] = [];
  const insertRows = async (rows: ExpenseRow[]) => {
    saved.push(rows);
    return rows.map((r) => ({ title: r.title, amount: r.amount }));
  };
  const memoStore = new Map<string, PendingMemo>();
  const callModel = async () => ({
    tool: "add_expense",
    args: '{"items":[{"amount":40,"note":"ปลาทู"},{"amount":20,"note":"โซดา"},{"amount":15,"note":"กาแฟ"}]}',
    reply: "",
  });
  const runTool = async () => { throw new Error("must not be called") };
  await processLineEvent(textEvent("ตี๋น้อย"), { client, callModel, runTool, insertRows, memoStore, userIdFor: () => "u1" });
  assert.equal(saved.length, 0, "nothing written until the user confirms");
  const pending = memoStore.get("U1");
  assert.ok(pending, "pending memo stored for the flex tap");
  assert.equal(pending.rows.length, 3);
  assert.ok(/^memo:save:[0-9a-f]+$/.test(`memo:save:${pending.id}`), "button data carries the card id");
  assert.equal(client.pushes.length, 1);
  assert.equal(client.pushes[0].messages[0].type, "flex");
  assert.match(JSON.stringify(client.pushes[0].messages[0]), /บันทึก/);
  assert.match(JSON.stringify(client.pushes[0].messages[0]), /#fbb046|"backgroundColor":"#fbb046"/, "orange brand applied");
  assert.match(JSON.stringify(client.pushes[0].messages[0]), /รวม/);
});

test("postback memo:save inserts the pending rows and replies", async () => {
  const client = new FakeClient();
  const rows = [{ title: "ปลาทู", amount: "40.00", userId: "u1", id: "r1" } as unknown as ExpenseRow];
  const memoStore = new Map<string, PendingMemo>([["U1", { id: "m1", rows }]]);
  let savedCalls = 0;
  const insertRows = async (r: ExpenseRow[]) => {
    savedCalls++;
    return r.map((x) => ({ title: x.title, amount: x.amount }));
  };
  await processLineEvent(postbackEvent("memo:save:m1"), { client, insertRows, memoStore, userIdFor: () => "u1" });
  assert.equal(savedCalls, 1);
  assert.equal(memoStore.has("U1"), false, "pending memo dropped after confirm");
  assert.equal(client.replies.length, 1);
  assert.match(firstText(client.replies[0].messages[0]), /บันทึกแล้วครับ/);
});

test("postback memo:cancel drops the memo and confirms", async () => {
  const client = new FakeClient();
  const memoStore = new Map<string, PendingMemo>([["U1", { id: "m1", rows: [{ title: "ปลาทู", amount: "40.00" } as ExpenseRow] }]]);
  const insertRows = async () => { throw new Error("must not be called"); };
  await processLineEvent(postbackEvent("memo:cancel:m1"), { client, insertRows, memoStore });
  assert.equal(memoStore.has("U1"), false);
  assert.equal(client.replies.length, 1);
  assert.match(firstText(client.replies[0].messages[0]), /ไม่จดแล้ว/);
});

test("postback memo:edit drops the memo and asks for the corrected copy", async () => {
  const client = new FakeClient();
  const memoStore = new Map<string, PendingMemo>([["U1", { id: "m1", rows: [{ title: "ปลาทู", amount: "40.00" } as ExpenseRow] }]]);
  const insertRows = async () => { throw new Error("must not be called"); };
  await processLineEvent(postbackEvent("memo:edit:m1"), { client, insertRows, memoStore });
  assert.equal(memoStore.has("U1"), false, "old copy dropped, nothing saved");
  assert.equal(client.replies.length, 1);
  assert.match(firstText(client.replies[0].messages[0]), /แก้แล้ว/);
});

test("postback with no pending memo says the card is stale and saves nothing", async () => {
  const client = new FakeClient();
  const insertRows = async () => { throw new Error("must not be called"); };
  await processLineEvent(postbackEvent("memo:save:m1"), { client, insertRows, memoStore: new Map() });
  assert.equal(client.replies.length, 1);
  assert.match(firstText(client.replies[0].messages[0]), /การ์ด/);
});

test("stale card id is a no-op, never saves the wrong memo", async () => {
  const client = new FakeClient();
  const rows = [{ title: "ปลาทู", amount: "40.00" } as ExpenseRow];
  const memoStore = new Map<string, PendingMemo>([["U1", { id: "m1", rows }]]);
  const insertRows = async () => { throw new Error("must not be called"); };
  // A card from the previous memo (id m2) taps after a newer memo (m1) replaced it.
  await processLineEvent(postbackEvent("memo:cancel:m2"), { client, insertRows, memoStore });
  assert.equal(memoStore.has("U1"), true, "current pending memo untouched");
  assert.equal(client.replies.length, 1);
  assert.match(firstText(client.replies[0].messages[0]), /การ์ด/);
});

test("non-memo postback data is ignored", async () => {
  const client = new FakeClient();
  await processLineEvent(postbackEvent("other:thing"), { client });
  assert.equal(client.replies.length + client.pushes.length, 0);
});
