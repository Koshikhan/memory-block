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

test("staff sees a clear error when microphone permission is denied", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(
      navigator,
      "mediaDevices",
      {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException(
              "Permission denied",
              "NotAllowedError"
            );
          },
        },
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
    page.getByText(
      "Microphone access was denied. Allow it in your browser settings.",
      { exact: true }
    )
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Record now",
    })
  ).toBeEnabled();
});


test("staff sees a clear error when browser recording is unsupported", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(
      window,
      "MediaRecorder",
      {
        configurable: true,
        value: undefined,
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
    page.getByText(
      "Recording requires a supported browser and HTTPS or localhost.",
      { exact: true }
    )
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Record now",
    })
  ).toBeEnabled();
});

test("staff sees an error when recording captures no audio and can try again", async ({
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

    class EmptyMediaRecorder {
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

        // Deliberately provide no audio chunks.
        this.onstop?.();
      }
    }

    Object.defineProperty(
      window,
      "MediaRecorder",
      {
        configurable: true,
        value: EmptyMediaRecorder,
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
    page.getByText(
      "No audio was captured. Please try again.",
      { exact: true }
    )
  ).toBeVisible();

  await expect(
    page.getByText("Voice note ready")
  ).toBeHidden();

  await expect(
    page.getByRole("button", {
      name: "Record now",
    })
  ).toBeEnabled();

  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeDisabled();
});


test("staff can recover after the recorder reports an error", async ({
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

    class FailingMediaRecorder {
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

        queueMicrotask(() => {
          this.state = "inactive";
          this.onerror?.();
        });
      }

      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }

    Object.defineProperty(
      window,
      "MediaRecorder",
      {
        configurable: true,
        value: FailingMediaRecorder,
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
    page.getByText(
      "Recording failed. Please try again.",
      { exact: true }
    )
  ).toBeVisible();

  // After a recorder failure the UI must return to its idle state
  // so the user can immediately try recording again.
  await expect(
    page.getByRole("button", {
      name: "Record now",
    })
  ).toBeEnabled();

  await expect(
    page.getByText("Voice note ready")
  ).toBeHidden();

  await expect(
    page.getByRole("button", {
      name: "Save memory",
    })
  ).toBeDisabled();
});
