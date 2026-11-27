import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "chrome",
    headless: true,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: {
    command:
      process.platform === "win32"
        ? "npm.cmd run dev -- --port 5174 --bypass-lock"
        : "npm run dev -- --port 5174 --bypass-lock",
    url: "http://127.0.0.1:5174",
    env: {
      AGENDAMENTO_E2E: "1",
      VITE_DEMO_MODE: "true",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    },
    reuseExistingServer: true,
    timeout: 30000,
  },
});
