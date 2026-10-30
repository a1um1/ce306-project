import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

// The API runs as its own Hono process (see `src/server/`). The browser calls it
// at VITE_API_URL; this server only renders the app.
export default defineConfig({
  server: { port: 3000 },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [tanstackStart(), nitro(), viteReact()],
})
