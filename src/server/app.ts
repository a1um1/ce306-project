import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "@/lib/auth";
import { categoryRoutes } from "./routes/categories";
import { expenseRoutes } from "./routes/expenses";
import { importJobRoutes } from "./routes/import-jobs";
import { lineRoutes } from "./routes/line";
import { sessionRoutes } from "./routes/session";
import { slipRoutes } from "./routes/slips";

export const app = new Hono();

// In dev the web server proxies `/api` onto its own origin, so CORS only matters
// when the browser calls the API directly (VITE_API_URL pointing at it).
app.use(
  "/api/*",
  cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true }),
);

app.get("/health", (c) => c.json({ ok: true }));

// Better Auth owns /api/auth/*: Google sign-in, callbacks, session, sign-out.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api", sessionRoutes);
app.route("/api/expenses", expenseRoutes);
app.route("/api/categories", categoryRoutes);
app.route("/api/import-jobs", importJobRoutes);
app.route("/api/slips", slipRoutes);
app.route("/api/line", lineRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  console.error("[api]", error);
  return c.json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
});
