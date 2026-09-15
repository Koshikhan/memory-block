import { test, expect } from "@playwright/test";

test("staff can complete the memory creation form without submitting", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByLabel("Order number")
    .fill("TEST-PLAYWRIGHT-001");

  await page
    .getByLabel("Customer name")
    .fill("Playwright Customer");

  await page
    .getByLabel("Email")
    .fill("playwright@example.com");

  await page
    .getByLabel("Mobile")
    .fill("07700123456");

  await page
    .getByLabel("From")
    .fill("Test Sender");

  await page
    .getByLabel("For")
    .fill("Test Recipient");

  await page
    .getByLabel("Short message — optional")
    .fill("Automated test memory.");

  await expect(
    page.getByLabel("Order number")
  ).toHaveValue("TEST-PLAYWRIGHT-001");

  await expect(
    page.getByLabel("Customer name")
  ).toHaveValue("Playwright Customer");

  await expect(
    page.getByLabel("From")
  ).toHaveValue("Test Sender");

  await expect(
    page.getByLabel("For")
  ).toHaveValue("Test Recipient");

  // Default workflow should be staff recording/upload.
  await expect(
    page.getByLabel("Upload a voice note")
  ).toBeVisible();

  // Without audio, staff should not be able to save.
  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeDisabled();

  // Switch to customer-upload-later mode.
  await page
    .getByRole("button", {
      name: /Customer uploads later/,
    })
    .click();

  await expect(
    page.getByLabel("Upload a voice note")
  ).toBeHidden();

  await expect(
    page.getByRole("button", {
      name: "Create order & upload link",
    })
  ).toBeVisible();

  // Switch back to staff mode.
  await page
    .getByRole("button", {
      name: /Add recording now/,
    })
    .click();

  await expect(
    page.getByLabel("Upload a voice note")
  ).toBeVisible();

  // Important: test ends here.
  // Nothing is submitted to Supabase.
});
