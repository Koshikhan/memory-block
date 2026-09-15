import { test, expect } from "@playwright/test";

test("public add-memory page loads successfully", async ({
  page,
}) => {
  const response = await page.goto("/add-memory");

  expect(response).not.toBeNull();
  expect(response?.ok()).toBeTruthy();

  await expect(page).toHaveURL(
    /\/add-memory$/
  );

  await expect(
    page.locator("body")
  ).toBeVisible();
});
