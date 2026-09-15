import { test, expect } from "@playwright/test";

test("authenticated staff can open orders", async ({
  page,
}) => {
  await page.goto("/orders");

  await expect(page).toHaveURL(
    /\/orders$/
  );

  await expect(
    page.getByRole("heading", {
      name: "Orders",
    })
  ).toBeVisible();
});

test("authenticated staff can open QR inventory", async ({
  page,
}) => {
  await page.goto("/qr-inventory");

  await expect(page).toHaveURL(
    /\/qr-inventory$/
  );

  await expect(
    page.getByRole("heading", {
      name: "QR Inventory",
    })
  ).toBeVisible();
});
