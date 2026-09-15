import {
  defineConfig,
  devices,
} from "@playwright/test";

import dotenv from "dotenv";

dotenv.config({
  path: ".env.test.local",
  quiet: true,
});

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is missing from .env.test.local"
  );
}

const isLocalSupabase =
  supabaseUrl.includes("127.0.0.1") ||
  supabaseUrl.includes("localhost");

if (!isLocalSupabase) {
  throw new Error(
    `E2E SAFETY CHECK FAILED: refusing to run against non-local Supabase: ${supabaseUrl}`
  );
}

export default defineConfig({
  testDir: "./tests",

  /*
   * These E2E tests share one local
   * Supabase instance and perform real
   * database/storage operations.
   *
   * Run them sequentially for stability.
   */
  fullyParallel: false,
  workers: 1,

  /*
   * Full workflows include:
   * Next.js rendering,
   * Supabase DB operations,
   * signed storage uploads,
   * and cleanup.
   */
  timeout: 120_000,

  forbidOnly: !!process.env.CI,

  retries:
    process.env.CI ? 2 : 0,

  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
      },
    ],
  ],

  use: {
    baseURL:
      "http://127.0.0.1:3100",

    trace:
      "retain-on-failure",

    screenshot:
      "only-on-failure",

    video:
      "retain-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch:
        /.*\.setup\.ts/,
    },

    {
      name: "chromium",

      use: {
        ...devices[
          "Desktop Chrome"
        ],

        storageState:
          "playwright/.auth/staff.json",
      },

      dependencies: [
        "setup",
      ],

      testIgnore:
        /.*\.setup\.ts/,
    },
  ],

  webServer: {
    command:
      "npm run dev -- --hostname 127.0.0.1 --port 3100",

    url:
      "http://127.0.0.1:3100",

    reuseExistingServer:
      !process.env.CI,

    timeout: 120_000,
  },
});
