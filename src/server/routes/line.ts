// LINE Messaging API webhook. LINE signs every request with the channel secret
// (HMAC-SHA256 over the raw body), so read the body as text and verify before
// parsing. Always answer 200 for accepted events, otherwise LINE retries.
import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";

export const lineRoutes = new Hono();

const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

function verify(secret: string, body: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function reply(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch(REPLY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

lineRoutes.post("/webhook", async (c) => {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return c.json({ error: "LINE_CHANNEL_SECRET not set" }, 503);

  const body = await c.req.text();
  const signature = c.req.header("x-line-signature");
  if (!signature || !verify(secret, body, signature)) {
    return c.json({ error: "Bad signature" }, 401);
  }

  let payload: { events?: Array<Record<string, any>> };
  try {
    payload = JSON.parse(body);
  } catch {
    return c.json({ error: "Bad JSON" }, 400);
  }

  for (const event of payload.events ?? []) {
    console.log("[line] event:", event);
    // if (event.type !== "message" || event.message?.type !== "text") continue;
    // try {
    //   await reply(event.replyToken, event.message.text);
    // } catch (error) {
    //   console.error("[line] reply failed:", error);
    // }
  }

  return c.json({ ok: true });
});
