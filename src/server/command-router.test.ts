import assert from "node:assert/strict";
import test from "node:test";
import { routeCommand } from "../lib/command-router";

test("routes the deterministic summary commands", () => {
  assert.deepEqual(routeCommand("สรุปวันนี้"), { kind: "summary", scope: "today" });
  assert.deepEqual(routeCommand("สรุปเดือนนี้"), { kind: "summary", scope: "month" });
});

test("routes delete-last and help, case-insensitively", () => {
  assert.deepEqual(routeCommand("ลบล่าสุด"), { kind: "delete-last" });
  assert.deepEqual(routeCommand("Help"), { kind: "help" });
  assert.deepEqual(routeCommand(" ช่วยเหลือ "), { kind: "help" });
});

test("leaves ordinary memos to the parser", () => {
  assert.equal(routeCommand("ปลาทู 40"), null);
  assert.equal(routeCommand("สรุป"), null);
  assert.equal(routeCommand("ช่วยเหลือฉันหน่อย"), null);
});
