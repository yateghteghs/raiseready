import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (spec section 11, milestone 10).
 *
 * - `public` and `mobile` need no accounts or keys. Without E2E_BASE_URL they
 *   build and start the app locally with a placeholder Supabase project.
 * - `core-loop` signs up a throwaway founder and runs the whole product
 *   against a real deployment. It needs E2E_BASE_URL plus the deployment's
 *   Supabase URL and service-role key, and is skipped otherwise.
 */
const external = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "public", testMatch: /public\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: /public\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "core-loop", testMatch: /core-loop\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: external
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        // Public pages only. Nothing listens here, and signed-out visitors
        // never need Supabase to answer.
        env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399", NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder" },
      },
});
