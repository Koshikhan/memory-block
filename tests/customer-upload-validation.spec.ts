import { test, expect } from "@playwright/test";

test("customer upload later requires email or mobile", async ({
  page,
}) => {
  let memoryInsertRequested = false;

  page.on("request", (request) => {
    if (
      request.url().includes("/rest/v1/memories") &&
      request.method() === "POST"
    ) {
      memoryInsertRequested = true;
    }
  });

  await page.goto("/");

  await page
    .getByLabel("Order number")
    .fill("TEST-NO-CONTACT");

  await page
    .getByLabel("Customer name")
    .fill("Playwright Customer");

  await page
    .getByLabel("From")
    .fill("Test Sender");

  await page
    .getByLabel("For")
    .fill("Test Recipient");

  // Intentionally leave both contact fields blank.
  await expect(
    page.getByLabel("Email")
  ).toHaveValue("");

  await expect(
    page.getByLabel("Mobile")
  ).toHaveValue("");

  await page
    .getByRole("button", {
      name: /Customer uploads later/,
    })
    .click();

  await expect(
    page.getByRole("button", {
      name: "Create order & upload link",
    })
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Create order & upload link",
    })
    .click();

  await expect(
    page.getByText(
      "Enter the customer’s email address or mobile number."
    )
  ).toBeVisible();

  // Validation should stop before Supabase insert.
  expect(memoryInsertRequested).toBe(false);
});
