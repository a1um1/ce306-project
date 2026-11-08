#!/bin/sh
# Dev stack: API, web, slip reader, LINE tunnel. Ctrl+C / SIGTERM stops them all.
trap 'kill 0; exit' INT TERM EXIT
PATH="$PWD/node_modules/.bin:$PATH"

tsx watch src/server/index.ts &
vite dev &
bun run slips:prod &
bun run line:dev &

wait
