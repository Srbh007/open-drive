import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    pool: 'forks',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    env: {
      SKIP_ENV_VALIDATION: "1"
    },
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js')
    }
  }
})
