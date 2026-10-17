# payTail

Track your own spending. TanStack Start + Better Auth (Google) + Drizzle + Postgres + Base UI (CSS Modules, no Tailwind).

## Stack

- **Framework:** TanStack Start (React 19, Vite, Nitro node-server)
- **Auth:** Better Auth, Google sign-in only
- **DB:** Postgres (Docker) via Drizzle ORM (`postgres-js`)
- **UI:** Base UI components + CSS Modules

## Setup

```bash
pnpm install
cp .env.example .env          # then fill BETTER_AUTH_SECRET + Google creds
pnpm db:up                    # start Postgres
pnpm db:migrate               # create auth tables
pnpm dev                      # http://localhost:3000
```

Generate the auth secret with `openssl rand -base64 32`.

### Google OAuth

1. Create OAuth credentials at <https://console.cloud.google.com/apis/credentials>.
2. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
3. Put the client id/secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Dev server (port 3000) |
| `pnpm build` | Production build to `.output/` |
| `pnpm start` | Run the production build |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:up` / `db:down` | Start / stop Postgres |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations |
| `pnpm db:studio` | Drizzle Studio |

## Layout

```
src/
  db/            Drizzle client + auth schema
  lib/           Better Auth server instance + client
  routes/        File-based routes (index, api/auth/$)
  styles/        Global CSS
  router.tsx
docker-compose.yml
drizzle/         Generated SQL migrations
tools/slip-reader/   KBank slip OCR tool (Swift + Node CLI)
```

## Slip reader tool

`tools/slip-reader` is a standalone macOS tool: a Swift Vision OCR binary plus a thin Node CLI.

```bash
cd tools/slip-reader
pnpm build                    # swiftc -> bin/slipreader
node cli.ts data --json
```

Swift sources are split under `tools/slip-reader/Sources/` (`Ocr`, `Parsing`, `Fields`, `Highlight`) with `main.swift` as the entry point.
