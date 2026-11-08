import assert from "node:assert/strict";
import test from "node:test";
import {
  LlmMemoParser,
  MemoParseError,
  validateMemo,
  occurredAtFor,
  todayInTz,
  MIN_AMOUNT,
  MAX_AMOUNT,
} from "./memo-parser";

process.env.LLM_API_KEY = "test-key";
process.env.LLM_MODEL = "test-model";

// A fetch stub that answers every LLM call with the given JSON content.
function parser(respond: unknown, opts?: { status?: number; body?: unknown }): LlmMemoParser {
  const fetchImpl = async () => {
    if (opts?.status) {
      return {
        ok: false,
        status: opts.status,
        json: async () => opts.body,
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(respond) } }] }),
    } as Response;
  };
  return new LlmMemoParser(fetchImpl);
}

const CONTEXT = {
  timezone: "Asia/Bangkok",
  userCategories: ["อาหาร", "ช้อปปิ้ง", "เดินทาง"],
};

// The examples the router must handle. The LLM does the heavy lifting; these
// pin the contract: Thai text in, structured items out.
const EXAMPLES: { text: string; amount: number; note: string; type?: string; date?: string | null; items?: number }[] = [
  { text: "ปลาทู 40", amount: 40, note: "ปลาทู" },
  { text: "กาแฟ 60 บาท", amount: 60, note: "กาแฟ" },
  { text: "เมื่อวานข้าวมันไก่ 55", amount: 55, note: "ข้าวมันไก่", date: null },
  { text: "เงินเดือน 25000", amount: 25000, note: "เงินเดือน", type: "income" },
  { text: "ข้าว 50 น้ำ 20", amount: 50, note: "ข้าว", items: 2 },
  { text: "สี่สิบบาท", amount: 40, note: "ไม่ระบุ" },
  { text: "ก๋วยเตี๋ยว ๑๒๐ บาท", amount: 120, note: "ก๋วยเตี๋ยว" },
  { text: "ค่ารถ 1.5k", amount: 1500, note: "ค่ารถ" },
  { text: "หนึ่งพันบาท", amount: 1000, note: "ไม่ระบุ", items: 1 },
  { text: "วานก่อนชานม 45", amount: 45, note: "ชานม", date: null },
  { text: "ค่าไฟ 800", amount: 800, note: "ค่าไฟ", date: new Date().toISOString().slice(0, 10) },
];

test("parses Thai memos into structured items (mocked LLM)", async () => {
  for (const example of EXAMPLES) {
    const count = example.items ?? 1;
    const llm = parser({ items: Array.from({ length: count }, () => ({ amount: example.amount, note: example.note, category: null, type: example.type ?? "expense", date: example.date ?? null })), needsClarification: null, confidence: 1 });
    const memo = await llm.parse(example.text, CONTEXT);
    assert.equal(memo.items.length, count, example.text);
    const item = memo.items[0];
    assert.equal(item.amount, example.amount, example.text);
    assert.equal(item.type, example.type ?? "expense", example.text);
  }
});

test("keeps multiple items from one memo", async () => {
  const llm = parser({
    items: [
      { amount: 50, note: "ข้าว", category: "อาหาร", type: "expense", date: null },
      { amount: 20, note: "น้ำ", category: "อาหาร", type: "expense", date: null },
    ],
    needsClarification: null,
    confidence: 1,
  });
  const memo = await llm.parse("ข้าว 50 น้ำ 20", CONTEXT);
  assert.equal(memo.items.length, 2);
  assert.equal(memo.items[0].amount + memo.items[1].amount, 70);
});

test("maps income for salary", async () => {
  const llm = parser({
    items: [{ amount: 25000, note: "เงินเดือน", category: null, type: "income", date: null }],
    needsClarification: null,
    confidence: 1,
  });
  const memo = await llm.parse("เงินเดือน 25000", CONTEXT);
  assert.equal(memo.items[0].type, "income");
});

test("asks for a missing amount via needs_clarification, no items", async () => {
  const llm = parser({
    items: [],
    needs_clarification: "กี่บาทครับ?",
    confidence: 0.5,
  });
  const memo = await llm.parse("ปลาทู", CONTEXT);
  assert.equal(memo.items.length, 0);
  assert.ok(memo.needsClarification);
});

test("treats greetings as no-parse (empty items, no clarification)", async () => {
  const llm = parser({ items: [], needsClarification: null, confidence: 0.2 });
  const memo = await llm.parse("สวัสดีครับสบายดีไหม", CONTEXT);
  assert.equal(memo.items.length, 0);
  assert.equal(memo.needsClarification, null);
});

test("passes the user's categories into the system prompt", async () => {
  let prompt = "";
  const spy: LlmMemoParser = new LlmMemoParser(
    async (_url, init) => {
      prompt = String((JSON.parse(String(init?.body)).messages as { content: string }[])[0]?.content ?? "");
      throw new Error("stop");
    },
  );
  await assert.rejects(() => spy.parse("x", CONTEXT));
  assert.match(prompt, /อาหาร, ช้อปปิ้ง, เดินทาง/);
  assert.match(prompt, /SECURITY/);
  assert.match(prompt, /Asia\/Bangkok/);
});

test("rejects an amount above the trust limit", async () => {
  const llm = parser({
    items: [{ amount: MAX_AMOUNT + 1, note: "เงินก้อน", category: null, type: "expense", date: null }],
    needsClarification: null,
    confidence: 1,
  });
  await assert.rejects(() => llm.parse("10000000", CONTEXT), MemoParseError);
});

test("rejects non-positive amounts", async () => {
  assert.throws(() => validateMemo({ items: [{ amount: MIN_AMOUNT, note: "x", type: "expense", date: null }], needsClarification: null, confidence: 1 }), MemoParseError);
  assert.throws(() => validateMemo({ items: [{ amount: -5, note: "x", type: "expense", date: null }], needsClarification: null, confidence: 1 }), MemoParseError);
});

test("rejects non-JSON or structurally invalid LLM output", async () => {
  const badJson = new LlmMemoParser(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "not json" } }] }) }) as Response);
  await assert.rejects(() => badJson.parse("x", CONTEXT), MemoParseError);

  const badShape = parser({ items: "nope", needsClarification: null });
  await assert.rejects(() => badShape.parse("x", CONTEXT), MemoParseError);
});

test("surfaces a failing upstream as MemoParseError", async () => {
  const failing = parser(null, { status: 500 });
  await assert.rejects(() => failing.parse("x", CONTEXT), MemoParseError);
});

test("todayInTz returns the wall-clock date of the zone", () => {
  const at = new Date("2026-01-01T00:30:00Z"); // 07:30 Bangkok same day
  assert.equal(todayInTz("Asia/Bangkok", at), "2026-01-01");
});

test("occurredAtFor resolves a date at noon in the target zone", () => {
  const d = occurredAtFor("2026-01-01", "Asia/Bangkok", new Date("2026-01-02T00:00:00Z"));
  // Bangkok noon = 05:00 UTC
  assert.equal(d.toISOString(), "2026-01-01T05:00:00.000Z");
});

test("occurredAtFor defaults to now when no date", () => {
  const now = new Date("2026-01-02T03:04:05Z");
  assert.equal(occurredAtFor(null, "Asia/Bangkok", now), now);
});
