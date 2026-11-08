import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyLineSignature } from "./line-verify";

const SECRET = "channel-secret-secret-secret";
const BODY = '{"events":[{"type":"message"}]}';

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

test("accepts a correct signature", () => {
  assert.equal(verifyLineSignature(SECRET, BODY, sign(BODY)), true);
});

test("rejects a signature made with a different secret", () => {
  assert.equal(verifyLineSignature(SECRET, BODY, sign(BODY, "wrong-secret")), false);
});

test("rejects a tampered body (signature for other payload)", () => {
  assert.equal(verifyLineSignature(SECRET, BODY, sign('{"events":[]}')), false);
});

test("rejects a signature with a different length (timing-safe guard)", () => {
  assert.equal(verifyLineSignature(SECRET, BODY, "c2hvcnQ="), false);
});

test("rejects an empty signature string", () => {
  assert.equal(verifyLineSignature(SECRET, BODY, ""), false);
});
