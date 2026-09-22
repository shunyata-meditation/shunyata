import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node tests/fixture-api.mjs',
      url: 'http://127.0.0.1:8100/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: false,
      env: {
        BACKEND_API_URL: 'http://127.0.0.1:8100/api',
        SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters',
      },
    },
  ],
})
