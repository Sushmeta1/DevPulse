import { defineConfig } from '@playwright/test';

const PORT = 4310;
const BASE = `http://localhost:${PORT}`;

// The suite drives the real backend + built frontend in demo mode, so it needs no GitHub or AI credentials.
// Needs PostgreSQL: set E2E_DATABASE_URL (or TEST_DATABASE_URL). Run `npm run e2e` (builds first).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'node ../backend/server.js',
    url: `${BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(PORT),
      BASE_URL: BASE,
      FRONTEND_URL: BASE,
      RATE_LIMIT_SCALE: '100', // the suite signs into the demo dozens of times from one IP
      JWT_SECRET: 'e2e-secret',
      TOKEN_ENCRYPTION_KEY: 'e2e-key',
      DATABASE_URL: process.env.E2E_DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://devpulse:devpulse@localhost:5432/devpulse_test',
    },
  },
});
