import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/staff.json";

setup("authenticate staff", async ({ page }) => {
  const email = process.env.TEST_STAFF_EMAIL;
  const password = process.env.TEST_STAFF_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing TEST_STAFF_EMAIL or TEST_STAFF_PASSWORD in .env.test.local"
    );
  }

  await page.goto("/login");

  await page
    .getByLabel("Email address")
    .fill(email);

  await page
    .getByLabel("Password")
    .fill(password);

  await page
    .getByRole("button", {
      name: "Sign in",
    })
    .click();

  await expect(page).toHaveURL("/");

  await expect(
    page.getByText("MEMORY BLOCK").first()
  ).toBeVisible();

  await page.context().storageState({
    path: authFile,
  });
});
