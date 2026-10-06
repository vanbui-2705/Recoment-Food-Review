import { defineConfig } from "@playwright/test";
const preview = process.env.PLAYWRIGHT_PREVIEW === "true";
const baseURL = preview ? "http://127.0.0.1:4173" : "http://127.0.0.1:5173";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 2,
  timeout: 60000,
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: preview
      ? "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort"
      : "node node_modules/vite/bin/vite.js --host 127.0.0.1",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
