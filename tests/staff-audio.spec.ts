import { test, expect } from "@playwright/test";

test("staff audio upload rejects unsupported files", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.getByLabel("Upload a voice note");

  await input.setInputFiles({
    name: "not-audio.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("This is not an audio file"),
  });

  await expect(
    page.getByText(
      "Please choose an MP3, M4A, WAV, OGG, OPUS or WebM file."
    )
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeDisabled();
});

test("staff can select a valid audio file", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.getByLabel("Upload a voice note");

  await input.setInputFiles({
    name: "test-recording.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from([
      0x49,
      0x44,
      0x33,
      0x04,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]),
  });

  await expect(
    page.getByText("Voice note ready")
  ).toBeVisible();

  await expect(
    page.getByText("test-recording.mp3")
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeEnabled();

  // Nothing is submitted.
});

test("staff can remove a selected audio file", async ({
  page,
}) => {
  await page.goto("/");

  const input =
    page.getByLabel("Upload a voice note");

  await input.setInputFiles({
    name: "test-recording.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from([
      0x49,
      0x44,
      0x33,
      0x04,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]),
  });

  await expect(
    page.getByText("Voice note ready")
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeEnabled();

  await page
    .getByRole("button", {
      name: "Remove",
    })
    .click();

  await expect(
    page.getByText("Voice note ready")
  ).toBeHidden();

  await expect(
    page.getByText("test-recording.mp3")
  ).toBeHidden();

  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeDisabled();

  // No order is submitted.
});
