import { defineConfig, devices } from "@playwright/test";

// List of tests that modify global settings or system state and must run sequentially
const SERIAL_TESTS = ["**/settings.spec.ts", "**/timeline.spec.ts"];

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    /* Parallel-safe Projects (run first concurrently using multiple workers) */
    {
      name: "chromium-parallel",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: SERIAL_TESTS,
    },

    {
      name: "firefox-parallel",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: SERIAL_TESTS,
    },

    /* Disable webkit test locally since it doesnt work with fedora out of the box
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        */

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome-parallel",
      use: { ...devices["Pixel 5"] },
      testIgnore: SERIAL_TESTS,
    },

    /* State-modifying Serial Projects (run sequentially using exactly 1 worker) */
    {
      name: "chromium-serial",
      use: { ...devices["Desktop Chrome"] },
      testMatch: SERIAL_TESTS,
      dependencies: [
        "chromium-parallel",
        "firefox-parallel",
        "Mobile Chrome-parallel",
      ],
      fullyParallel: false,
      workers: 1,
    },

    {
      name: "firefox-serial",
      use: { ...devices["Desktop Firefox"] },
      testMatch: SERIAL_TESTS,
      dependencies: ["chromium-serial"],
      fullyParallel: false,
      workers: 1,
    },

    {
      name: "Mobile Chrome-serial",
      use: { ...devices["Pixel 5"] },
      testMatch: SERIAL_TESTS,
      dependencies: ["firefox-serial"],
      fullyParallel: false,
      workers: 1,
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
     Local default: test container (3001) with production build.
     CI: production build (3000) built in a prior workflow step.
     Debug container (3002): set PLAYWRIGHT_BASE_URL=http://localhost:3002
     when using the hot-reloaded debug container. */
  webServer: {
    command: "npm start",
    url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
