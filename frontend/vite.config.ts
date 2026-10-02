import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The e2e suite (playwright.config.ts) points a second dev server at its own
// throwaway backend via API_PROXY_TARGET; everything else uses the real one.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // LAN-reachable, per PRD §9
    proxy: {
      '/api': apiTarget,
      '/static': apiTarget,
    },
  },
})
