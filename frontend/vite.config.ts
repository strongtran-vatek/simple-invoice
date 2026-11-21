import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // One .env at the repository root configures the whole stack (see .env.example).
  envDir: '..',
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Tests must not depend on a developer's .env file.
    env: { VITE_API_URL: 'http://api.test' },
  },
})
