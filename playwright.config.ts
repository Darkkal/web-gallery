import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  // ^ Why? Let's try it for now while the tests are simple and isloated - Darkkal
  workers: 5,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? "github" : "list",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-test-options. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3002",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    /* Disable webkit test locally since it doesnt work with fedora out of the box
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        */

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Connect to an existing server or start a production server.
     Local default: debug container (3002) with hot-reloaded source.
     CI: production build (3000) built in a prior workflow step.
     Test container (3001): set PLAYWRIGHT_BASE_URL=http://localhost:3001
     after rebuilding the image with `docker compose -f compose.test.yaml build`. */
  webServer: {
    command: "npm start",
    url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3002",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
