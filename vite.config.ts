import { defineConfig } from 'vitest/config'
import { debugWsPlugin } from './vite-plugin-debug-ws.ts'

export default defineConfig({
  plugins: [debugWsPlugin()],
  test: {
    environment: 'node',
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    allowedHosts: true,
  },
  build: {
    target: 'esnext',
  },
})
