import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3000";

// The demo store. Every seeded bounty uses these coordinates, so the
// geofence rule is meaningful rather than decorative.
export const DEMO_LAT = 12.9716;
export const DEMO_LNG = 77.5946;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./test-results",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // The capture screen is designed at 390px first, because the demo is
      // filmed on a phone.
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        permissions: ["geolocation"],
        geolocation: { latitude: DEMO_LAT, longitude: DEMO_LNG },
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
