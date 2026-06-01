import { defineConfig, devices } from "@playwright/test";

const E2E_ADMIN_PORT = 3100;
const E2E_API_PORT = 3101;
const E2E_ADMIN_URL = `http://localhost:${E2E_ADMIN_PORT}`;
const E2E_API_URL = `http://localhost:${E2E_API_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",

  use: {
    baseURL: E2E_ADMIN_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @structo/api dev",
      url: `${E2E_API_URL}/api/v1/health`,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        ...process.env,
        ADMIN_APP_URL: E2E_ADMIN_URL,
        API_PORT: String(E2E_API_PORT),
        NODE_ENV: "test",
      },
    },
    {
      command: `pnpm --filter @structo/admin exec next dev --port ${E2E_ADMIN_PORT}`,
      url: E2E_ADMIN_URL,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: `${E2E_API_URL}/api/v1`,
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
