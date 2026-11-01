import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'browser.spec.ts',
  timeout: 45000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:6012', browserName: 'chromium', viewport: { width: 1100, height: 900 } },
  webServer: {
    command: 'pnpm storybook --ci',
    url: 'http://127.0.0.1:6012',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
