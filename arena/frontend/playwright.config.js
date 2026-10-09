import { defineConfig } from '@playwright/test';

/** Real built SPA + real API + isolated SQLite verification DB; never .env DB. */
export default defineConfig({
  testDir: './test/e2e', workers: 1, fullyParallel: false, retries: 0,
  timeout: 30000, expect: { timeout: 7000 }, reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4310', headless: true,
    launchOptions: { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--disable-dev-shm-usage', '--no-zygote'] },
    screenshot: 'only-on-failure', trace: 'off',
  },
  webServer: {
    command: 'npm run build && node test/e2e/server.cjs',
    url: 'http://127.0.0.1:4310/api/health', timeout: 120000, reuseExistingServer: false,
  },
});
