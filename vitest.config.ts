import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The integration test runs a real VitePress production build.
    testTimeout: 300_000,
    hookTimeout: 120_000
  }
})
