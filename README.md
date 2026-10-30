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

## Slip reader tool

`tools/slip-reader` is a standalone macOS tool: a Swift Vision OCR binary plus a thin Node CLI.

```bash
cd tools/slip-reader
pnpm build                    # swiftc -> bin/slipreader
node cli.ts data --json
```

Swift sources are split under `tools/slip-reader/Sources/` (`Ocr`, `Parsing`, `Fields`, `Highlight`) with `main.swift` as the entry point.

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
