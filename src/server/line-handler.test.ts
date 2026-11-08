import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

// The handler's store is a pure interface; these tests drive it with memory so
// no Postgres is needed. db/index.ts opens a client at import, so give it a
// dummy URL first — app.test.ts does the same.
process.env.DATABASE_URL ??= "postgres://paytail:paytail@localhost:5432/paytail";
process.env.APP_TIMEZONE = "Asia/Bangkok";

const { processLineEvent, resetLineRuntime } = await import("./line-handler");
import type { LineStore, InsertableExpense } from "./line-event-store";
import type { LineMessage } from "./line-client";
import type { MemoParser, ParsedMemo } from "@/lib/utils/memo-parser";

type ExpenseRow = {
  id: string;
  userId: string;
  title: string;
  amount: number;
  categoryId: string | null;
  deletedAt: Date | null;
};

let seq = 0;
const newId = () => `id-${++seq}`;

class MemoryStore implements LineStore {
  events = new Set<string>();
  links = new Map<string, string>();
  codes = new Map<string, { userId: string; expiresAt: Date; used?: boolean; code: string }>();
  expenses: ExpenseRow[] = [];
  catList = [
    { id: "cat-food", name: "อาหาร" },
    { id: "cat-shop", name: "ช้อปปิ้ง" },
  ];
  inserted: { userId: string; items: InsertableExpense[]; rawText: string }[] = [];
  replaced: { id: string; userId: string; item: InsertableExpense }[] = [];
  deleted: string[] = [];
  setCat: [string, string][] = [];
  summaries: string[] = [];

  async beginEvent(id: string) {
    if (this.events.has(id)) return "duplicate" as const;
    this.events.add(id);
    return "inserted" as const;
  }
  async finishEvent(_id?: string, _ok?: boolean) {}
  async findLink(lineUserId: string) {
    const u = this.links.get(lineUserId);
    return u ? { userId: u } : null;
  }
  async findCode(code: string, now: Date) {
    const c = this.codes.get(code.toUpperCase());
    if (!c || c.used || c.expiresAt <= now) return null;
    return { code: c.code, userId: c.userId };
  }
  async createLink(userId: string, lineUserId: string) {
    this.links.set(lineUserId, userId);
  }
  async markCodeUsed(code: string) {
    const c = this.codes.get(code.toUpperCase());
    if (c) c.used = true;
  }
  async categories(userId: string) {
    return this.catList;
  }
  async insertExpenses(
    userId: string,
    items: InsertableExpense[],
    rawText: string,
  ) {
    this.inserted.push({ userId, items, rawText });
    return items.map((i) => ({ id: newId(), title: i.title, amount: i.amount.toFixed(2) }));
  }
  async latestLineExpense(userId: string) {
    const row = [...this.expenses].reverse().find((e) => e.userId === userId && !e.deletedAt);
    return row ? { id: row.id, title: row.title, amount: String(row.amount) } : null;
  }
  async softDeleteExpense(id: string, userId: string) {
    const e = this.expenses.find((x) => x.id === id && x.userId === userId);
    if (!e) return false;
    e.deletedAt = new Date();
    this.deleted.push(id);
    return true;
  }
  async getExpense(id: string, userId: string) {
    const e = this.expenses.find((x) => x.id === id && x.userId === userId);
    return e ? { id, title: e.title, amount: String(e.amount) } : null;
  }
  async setExpenseCategory(id: string, userId: string, categoryId: string) {
    const e = this.expenses.find((x) => x.id === id && x.userId === userId);
    if (!e) return false;
    e.categoryId = categoryId;
    this.setCat.push([id, categoryId]);
    return true;
  }
  async replaceExpense(id: string, userId: string, item: InsertableExpense) {
    this.replaced.push({ id, userId, item });
    return true;
  }
  async summary() {
    this.summaries.push("called");
    return { total: 1200, income: 0, count: 3, top: [{ name: "อาหาร", sum: 800 }] };
  }
}

class FakeClient {
  replies: { text: string }[][] = [];
  pushes: { userId: string; messages: { text: string }[] }[] = [];
  async replyMessage(_token: string, messages: LineMessage[]) {
    this.replies.push(messages as { text: string }[]);
    return true;
  }
  async pushMessage(userId: string, messages: LineMessage[]) {
    this.pushes.push({ userId, messages: messages as { text: string }[] });
    return true;
  }
}

class FakeParser implements MemoParser {
  queue: ParsedMemo[] = [];
  calls: string[] = [];
  async parse(text: string): Promise<ParsedMemo> {
    this.calls.push(text);
    const next = this.queue.shift();
    if (!next) throw new Error("FakeParser: no queued response");
    return next;
  }
}

const textEvent = (text: string, userId = "U1", id = newId()) => ({
  id,
  type: "message",
  source: { userId },
  replyToken: "token",
  message: { id: newId(), type: "text", text },
});
const postbackEvent = (data: string, userId = "U1", id = newId()) => ({
  id,
  type: "postback",
  source: { userId },
  replyToken: "token",
  postback: { data },
});

beforeEach(() => resetLineRuntime());

test("re-processes a duplicate event id only once (LINE retries)", async () => {
  const store = new MemoryStore();
  const client = new FakeClient();
  // Follow is reply-only (no LLM, no DB writes) so it is a clean probe.
  const event = (id: string) => ({
    id,
    type: "follow" as const,
    source: { userId: "U1" },
    replyToken: "token",
  });
  await processLineEvent(event("evt-1"), { store, client });
  assert.equal(client.replies.length, 1);
  await processLineEvent(event("evt-1"), { store, client });
  assert.equal(client.replies.length, 1, "retried event must not reply again");
});

test("links a user with a valid code", async () => {
  const store = new MemoryStore();
  store.codes.set("ABC234", { code: "ABC234", userId: "u1", expiresAt: new Date(Date.now() + 60_000) });
  const client = new FakeClient();
  await processLineEvent(textEvent("ABC234"), { store, client });
  assert.equal(store.links.get("U1"), "u1");
  assert.equal((store.codes.get("ABC234") as { used?: boolean }).used, true);
  assert.match(client.replies[0][0].text, /เชื่อมต่อสำเร็จ/);
});

test("rejects an expired code with the invalid message", async () => {
  const store = new MemoryStore();
  store.codes.set("ABC234", { code: "ABC234", userId: "u1", expiresAt: new Date(Date.now() - 1000) });
  const client = new FakeClient();
  await processLineEvent(textEvent("ABC234"), { store, client });
  assert.equal(store.links.has("U1"), false);
  assert.match(client.replies[0][0].text, /รหัสไม่ถูกต้องหรือหมดอายุ/);
});

test("rejects a reused (used) code", async () => {
  const store = new MemoryStore();
  store.codes.set("ABC234", { code: "ABC234", userId: "u1", expiresAt: new Date(Date.now() + 60_000), used: true });
  const client = new FakeClient();
  await processLineEvent(textEvent("ABC234"), { store, client });
  assert.equal(store.links.has("U1"), false);
  assert.match(client.replies[0][0].text, /รหัสไม่ถูกต้องหรือหมดอายุ/);
});

test("unlinked user sending other text gets instructions, not parsing", async () => {
  const store = new MemoryStore();
  const client = new FakeClient();
  const parser = new FakeParser();
  await processLineEvent(textEvent("สวัสดี"), { store, client, parser });
  assert.match(client.replies[0][0].text, /เชื่อมต่อ/);
  assert.equal(parser.calls.length, 0, "must not touch the parser when unlinked");
  assert.equal(store.inserted.length, 0);
});

test("replies to audio/image with the only-text notice", async () => {
  const client = new FakeClient();
  await processLineEvent(
    {
      id: "evt-audio",
      type: "message",
      source: { userId: "U1" },
      replyToken: "token",
      message: { id: "m", type: "audio" },
    },
    { store: new MemoryStore(), client },
  );
  assert.match(client.replies[0][0].text, /รองรับข้อความอย่างเดียว/);
});

test("postback delete verifies ownership: another user's expense is refused", async () => {
  const store = new MemoryStore();
  store.links.set("U1", "u1");
  store.expenses.push({ id: "exp-other", userId: "u2", title: "ของคนอื่น", amount: 100, categoryId: null, deletedAt: null });
  const client = new FakeClient();
  await processLineEvent(postbackEvent("paytail:delete:exp-other"), { store, client });
  assert.match(client.replies[0][0].text, /ไม่พบรายการ/);
  assert.equal(store.deleted.length, 0);
});

test("postback delete works on the linked user's own expense", async () => {
  const store = new MemoryStore();
  store.links.set("U1", "u1");
  store.expenses.push({ id: "exp-own", userId: "u1", title: "ปลาทู", amount: 40, categoryId: null, deletedAt: null });
  const client = new FakeClient();
  await processLineEvent(postbackEvent("paytail:delete:exp-own"), { store, client });
  assert.deepEqual(store.deleted, ["exp-own"]);
  assert.match(client.replies[0][0].text, /ลบแล้ว ✅/);
});

test("memo path: acks, parses, saves atomically with category mapping", async () => {
  const store = new MemoryStore();
  store.links.set("U1", "u1");
  const client = new FakeClient();
  const parser = new FakeParser();
  parser.queue.push({
    items: [{ amount: 40, note: "ปลาทู", category: "อาหาร", type: "expense", date: null }],
    needsClarification: null,
    confidence: 1,
  });
  await processLineEvent(textEvent("ปลาทู 40"), { store, client, parser });
  assert.equal(client.replies.length, 1, "fast ack via replyToken");
  assert.match(client.replies[0][0].text, /กำลังจด/);
  assert.equal(store.inserted.length, 1);
  assert.equal(store.inserted[0].rawText, "ปลาทู 40");
  assert.equal(store.inserted[0].items[0].categoryId, "cat-food");
  assert.equal(store.inserted[0].items[0].amount, 40);
  assert.match(client.pushes[0].messages[0].text, /จดแล้ว ✅ ปลาทู ฿40 · อาหาร/);
});

test("missing amount asks once, then the next message completes it", async () => {
  const store = new MemoryStore();
  store.links.set("U1", "u1");
  const client = new FakeClient();
  const parser = new FakeParser();
  parser.queue.push({ items: [], needsClarification: "กี่บาทครับ?", confidence: 0.4 });
  parser.queue.push({
    items: [{ amount: 40, note: "ปลาทู", category: null, type: "expense", date: null }],
    needsClarification: null,
    confidence: 0.9,
  });
  await processLineEvent(textEvent("ปลาทู"), { store, client, parser });
  assert.equal(store.inserted.length, 0, "nothing saved while amount is missing");
  assert.match(client.pushes[0].messages[0].text, /กี่บาท/);

  await processLineEvent(textEvent("40"), { store, client, parser });
  assert.equal(store.inserted.length, 1);
  assert.equal(parser.calls[1], "ปลาทู 40", "completion re-parses the combined memo");
});

test("LLM failure marks the event failed and apologises", async () => {
  const store = new MemoryStore();
  store.links.set("U1", "u1");
  const client = new FakeClient();
  const parser = new FakeParser(); // empty queue -> parse() throws
  let failed = false;
  class FailingStore extends MemoryStore {
    async finishEvent(_id: string, ok?: boolean) {
      if (ok === false) failed = true;
    }
  }
  const failingStore = new FailingStore();
  failingStore.links.set("U1", "u1");
  await processLineEvent(textEvent("ปลาทู 40"), {
    store: failingStore,
    client,
    parser: (parser as unknown) as MemoParser,
  });
  assert.equal(failed, true);
  assert.match(client.pushes[0].messages[0].text, /จดไม่สำเร็จ/);
});

test("delete-last soft-deletes the latest LINE expense", async () => {
  const store = new MemoryStore();
  store.links.set("U1", "u1");
  store.expenses.push({ id: "exp-1", userId: "u1", title: "ปลาทู", amount: 40, categoryId: null, deletedAt: null });
  const client = new FakeClient();
  await processLineEvent(textEvent("ลบล่าสุด"), { store, client });
  assert.deepEqual(store.deleted, ["exp-1"]);
  assert.match(client.replies[0][0].text, /ลบแล้ว ✅/);
});

test("summary command replies from the store aggregate", async () => {
  const store = new MemoryStore();
  store.links.set("U1", "u1");
  const client = new FakeClient();
  await processLineEvent(textEvent("สรุปวันนี้"), { store, client });
  assert.match(client.replies[0][0].text, /สรุปวันนี้/);
  assert.match(client.replies[0][0].text, /฿1,200/);
  assert.equal(store.summaries.length, 1);
});
