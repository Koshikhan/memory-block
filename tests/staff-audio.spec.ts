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
      "Please choose an MP3 file."
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

test("staff can use a browser-recorded voice note", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(
      navigator,
      "mediaDevices",
      {
        configurable: true,
        value: {
          getUserMedia: async () => ({
            getTracks: () => [
              {
                stop: () => {},
              },
            ],
          }),
        },
      }
    );

    class FakeMediaRecorder {
      static isTypeSupported(type: string) {
        return type === "audio/webm";
      }

      state: RecordingState = "inactive";
      mimeType: string;

      ondataavailable: ((event: BlobEvent) => void) | null =
        null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(
        _stream: MediaStream,
        options?: MediaRecorderOptions
      ) {
        this.mimeType =
          options?.mimeType || "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";

        const blob = new Blob(
          ["browser recorded audio"],
          {
            type: this.mimeType,
          }
        );

        this.ondataavailable?.({
          data: blob,
        } as BlobEvent);

        this.onstop?.();
      }
    }

    Object.defineProperty(
      window,
      "MediaRecorder",
      {
        configurable: true,
        value: FakeMediaRecorder,
      }
    );
  });

  await page.goto("/");

  await page
    .getByRole("button", {
      name: "Record now",
    })
    .click();

  await expect(
    page.getByRole("button", {
      name: "Stop recording",
    })
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Stop recording",
    })
    .click();

  await expect(
    page.getByText("Voice note ready")
  ).toBeVisible();

  await expect(
    page.getByText(
      /voice-recording-\d+\.webm/
    )
  ).toBeVisible();

  await expect(
    page.getByText(
      "Please choose an MP3 file."
    )
  ).toBeHidden();

  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeEnabled();

  // Browser recordings may use WebM/M4A/OGG internally.
  // Manual file uploads remain MP3-only.
});
