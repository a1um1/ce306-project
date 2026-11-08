# payTail

Track your own spending. TanStack Start + Hono API + Better Auth (Google) + Drizzle + Postgres + Base UI (CSS Modules, no Tailwind).

## Stack

- **Web:** TanStack Start (React 19, Vite, Nitro node-server)
- **API:** Hono, a separate server process (`src/server/`) on port 3001
- **Auth:** Better Auth, Google sign-in only, served by the Hono API
- **DB:** Postgres (Docker) via Drizzle ORM (`postgres-js`)
- **UI:** Base UI components + CSS Modules

## Setup

```bash
pnpm install
cp .env.example .env          # then fill BETTER_AUTH_SECRET + Google creds
pnpm db:up                    # start Postgres
pnpm db:migrate               # create tables
pnpm db:seed                  # insert built-in categories + merchant rules
pnpm dev                      # web on :3000 + API on :3001
```

Generate the auth secret with `openssl rand -base64 32`.

### Google OAuth

1. Create OAuth credentials at <https://console.cloud.google.com/apis/credentials>.
2. Add authorized redirect URI: `http://localhost:3001/api/auth/callback/google`
   (the API origin, since the Hono API serves `/api/auth`).
3. Put the client id/secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Web (3000) + API (3001) together |
| `pnpm dev:web` / `pnpm dev:api` | Run one side on its own |
| `pnpm line:dev` | Cloudflare tunnel + auto-set LINE webhook URL |
| `pnpm build` | Production build to `.output/` |
| `pnpm start` / `pnpm start:api` | Run the production web build / the API |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:up` / `db:down` | Start / stop Postgres |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations |
| `pnpm db:seed` | Insert built-in categories + seed merchant rules (idempotent) |
| `pnpm db:reset` | Wipe all data and re-seed built-ins (keeps schema) |
| `pnpm db:studio` | Drizzle Studio |

## Layout

```
src/
  db/            Drizzle client + auth schema
  lib/api/       Typed browser client for the API (fetch wrapper + modules)
  server/        Hono app: auth handler, resource routes, import worker, OCR
  lib/           Better Auth instance + client
  routes/        File-based web routes (dashboard, transactions, sign-in)
  styles/        Global CSS
  router.tsx
docker-compose.yml
drizzle/         Generated SQL migrations
tools/slip-reader/   KBank slip OCR tool (Swift + Node CLI)
```

## API

The web app talks to the Hono API over HTTP; the two are separate processes and
deploy independently.

- **Browser:** calls `VITE_API_URL` with credentials, allowed by CORS for
  `WEB_ORIGIN`. Session cookies are set by the API (use a shared parent domain,
  e.g. `app` + `api`, so they count as same-site).
- **Server-side render:** calls `API_URL` and forwards the incoming browser
  cookies, so `beforeLoad` guards work on the first paint.
- **Auth:** `/api/auth/*` lives on the API, so `BETTER_AUTH_URL` is the API's
  public URL and the Google redirect URI points there.

To serve both from one origin instead, put a reverse proxy in front that forwards
`/api` to the API and leave `VITE_API_URL` empty.

## LINE Messaging API

The API serves the webhook at `POST /api/line/webhook` and verifies LINE's
`x-line-signature` (HMAC-SHA256 of the raw body with `LINE_CHANNEL_SECRET`).
Text messages are echoed back.

1. Create a Messaging API channel at <https://developers.line.biz/console/>.
2. Put the channel secret and access token in `.env` as `LINE_CHANNEL_SECRET` /
   `LINE_CHANNEL_ACCESS_TOKEN`.
3. `pnpm dev` starts `pnpm line:dev` alongside the servers: it opens a Cloudflare
   quick tunnel to the API port (`cloudflared` must be installed) and sets the
   LINE webhook to `<tunnel>/api/line/webhook` on every launch. The trycloudflare
   URL changes each run, so the endpoint is re-set automatically.
4. In the LINE console, turn **Use webhook** on (Messaging API settings). The API
   can set the URL but cannot toggle that switch.

Run it on its own with `pnpm line:dev`. Without an access token it exits quietly.

## Slip reader tool

`tools/slip-reader` is a standalone macOS tool: Apple Vision reads the text off the
slip, and Apple's on-device foundation model turns that text into the fields
(JSON). There are no per-bank zones, templates or QR pattern matching: one prompt
reads any slip layout.

```bash
cd tools/slip-reader
pnpm build                    # swiftc -> bin/slipreader
node cli.ts data --json
```

Swift sources: `Sources/Ocr.swift` (Vision), `Sources/Fields.swift` (schema-guided
model call), `main.swift` (CLI). The model generates against a runtime
`GenerationSchema`, so it can only return the slip fields; `@Generable` structs
need the macro plugin that ships with full Xcode. Requires macOS 26+ with Apple
Intelligence enabled.
Dates and reference numbers are the mechanical steps: the model copies the printed
date line and `date.ts` converts the Buddhist-era year, because asking the model to
do that arithmetic misread times in testing. `fields.ts` picks `transactionId` from
the reference label in the OCR text, so a Biller ID or account number is not chosen.

### OCR service

Apple Vision only runs on macOS, so the reader can be exposed as a local REST
service instead of being spawned inside the API process:

```bash
pnpm slips:serve              # http://127.0.0.1:4100
```

| Env | Default | Purpose |
| --- | --- | --- |
| `SLIP_READER_PORT` | `4100` | Port |
| `SLIP_READER_HOST` | `127.0.0.1` | Bind address |
| `SLIP_READER_TOKEN` | — | Optional bearer token |

Endpoints: `GET /health`, and `POST /read` with `{ "dataUrls": [...] }`
returning `(SlipRead | null)[]`, one slot per image.

Nothing in the web app calls this directly: the API owns it. Set
`SLIP_READER_URL=http://127.0.0.1:4100` for the API to use the service; leave it
empty to run the binary in-process (the default).


### Labeling (training data)

`/label` (signed in) is a workbench over `tools/slip-reader/data`: it lists the
slips, runs the current reader, and lets you correct `amount`, `dateTime`,
`transactionId`, `sender` and `recipient`. Each saved slip is upserted into
`tools/slip-reader/training/labels.jsonl`:

```json
{"path":"kbank/slip.jpeg","ocrText":"...","predicted":{...},"label":{...},"updatedAt":"..."}
```

`ocrText` is the OCR input, `predicted` is what the current implementation said,
`label` is the human-corrected target. New photos can be uploaded from the page;
they land in `tools/slip-reader/data/uploads/`.

Set `SLIP_SAVE_READS=1` to keep every read the importer would accept, from both
the import flow and the reader test page: the image is copied to `data/imports/`
(content-addressed by a SHA-1 of the bytes) and saved to the same JSONL with
`predicted` and `label` equal, because nothing edited the values. The acceptance
gate only checks amount and reference, so a wrong date or name can still enter
the dataset; correct it in `/label` if `pnpm slips:eval` shows drift. Off by
default because it stores user photos.

Measure the current implementation against those labels with:

```bash
pnpm slips:eval
```

It re-reads every labeled slip and prints per-field accuracy plus each mismatch.
Low-resolution images (under ~500px wide) cannot be read reliably; those OCR
errors are not fixable by the model.
