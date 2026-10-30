import assert from "node:assert/strict";
import test from "node:test";

// app.ts reads its config at import time. Give it inert values so these tests
// run without a .env or a live Postgres: no request below authenticates.
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set to run tests");

const { app } = await import("./app.ts");

const ORIGIN = process.env.WEB_ORIGIN;

test("health check answers without auth", async () => {
  const res = await app.request("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("session endpoint returns null when signed out", async () => {
  const res = await app.request("/api/session", { headers: { Origin: ORIGIN } });
  assert.equal(res.status, 200);
  assert.equal(await res.json(), null);
});

// Every data route must resolve the user before touching the database.
test("data routes require a session", async () => {
  const routes: [string, string][] = [
    ["GET", "/api/expenses"],
    ["GET", "/api/expenses/external-ids"],
    ["POST", "/api/expenses"],
    ["POST", "/api/expenses/import"],
    ["PATCH", "/api/expenses/some-id"],
    ["DELETE", "/api/expenses/some-id"],
    ["GET", "/api/categories"],
    ["POST", "/api/categories"],
    ["POST", "/api/categories/suggest"],
    ["PATCH", "/api/categories/some-id"],
    ["POST", "/api/import-jobs"],
    ["GET", "/api/import-jobs/some-id"],
    ["POST", "/api/slips/read"],
  ];

  for (const [method, path] of routes) {
    const res = await app.request(path, { method, headers: { Origin: ORIGIN } });
    assert.equal(res.status, 401, `${method} ${path}`);
    assert.deepEqual(await res.json(), { error: "Unauthorized" }, `${method} ${path}`);
  }
});

test("better auth handlers are mounted at /api/auth", async () => {
  const res = await app.request("/api/auth/get-session", { headers: { Origin: ORIGIN } });
  assert.equal(res.status, 200);
  assert.equal(await res.json(), null);
});

test("cors allows the web origin with credentials", async () => {
  const res = await app.request("/api/expenses", {
    method: "OPTIONS",
    headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
});

test("unknown routes answer 404 json", async () => {
  const res = await app.request("/nope");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not found" });
});
