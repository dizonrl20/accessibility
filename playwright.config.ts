import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  timeout: 60000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
});
