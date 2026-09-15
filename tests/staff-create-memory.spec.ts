import {
  test,
  expect,
} from "@playwright/test";

import {
  localSupabaseAdmin,
} from "./helpers/local-supabase";

function createTestWav() {
  const sampleRate = 8000;
  const sampleCount = 800;
  const dataSize = sampleCount * 2;

  const buffer =
    Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(
    36 + dataSize,
    4
  );
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(
    sampleRate,
    24
  );
  buffer.writeUInt32LE(
    sampleRate * 2,
    28
  );
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(
    dataSize,
    40
  );

  return buffer;
}

test("staff can create a complete memory", async ({
  page,
}) => {
  const unique =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const orderNumber =
    `E2E-${unique}`;

  const customerName =
    `E2E Customer ${unique}`;

  const sender =
    `E2E Sender ${unique}`;

  const recipient =
    `E2E Recipient ${unique}`;

  let audioPath:
    | string
    | null = null;

  try {
    await page.goto("/");

    await page
      .getByLabel("Order number")
      .fill(orderNumber);

    await page
      .getByLabel("Customer name")
      .fill(customerName);

    await page
      .getByLabel("Email")
      .fill("e2e@example.com");

    await page
      .getByLabel("From")
      .fill(sender);

    await page
      .getByLabel("For")
      .fill(recipient);

    await page
      .getByLabel(
        "Short message — optional"
      )
      .fill(
        "Automated local E2E memory."
      );

    await page
      .getByLabel("Upload a voice note")
      .setInputFiles({
        name: "e2e-recording.mp3",
        mimeType: "audio/mpeg",
        buffer: createTestWav(),
      });

    await expect(
      page.getByText(
        "Voice note ready"
      )
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: "Save memory",
      })
      .click();

    let memory:
      | {
          id: string;
          public_code: string;
          status: string;
          upload_source: string;
          audio_path: string | null;
          sender_name: string;
          recipient_name: string;
        }
      | null = null;

    await expect
      .poll(
        async () => {
          const {
            data,
            error,
          } =
            await localSupabaseAdmin
              .from("memories")
              .select(
                "id,public_code,status,upload_source,audio_path,sender_name,recipient_name"
              )
              .eq(
                "order_number",
                orderNumber
              )
              .maybeSingle();

          if (error) {
            throw error;
          }

          memory = data;

          return data?.status;
        },
        {
          timeout: 10_000,
        }
      )
      .toBe("READY");

    expect(memory).not.toBeNull();

    expect(
      memory!.upload_source
    ).toBe("STAFF");

    expect(
      memory!.audio_path
    ).toBeTruthy();

    expect(
      memory!.sender_name
    ).toBe(sender);

    expect(
      memory!.recipient_name
    ).toBe(recipient);

    audioPath =
      memory!.audio_path;

    await page.goto(
      `/memory/${memory!.public_code}`
    );

    await expect(page).toHaveURL(
      new RegExp(
        `/memory/${memory!.public_code}$`
      )
    );

    await expect(
      page.locator("body")
    ).toContainText(recipient);

    await expect(
      page.locator("body")
    ).toContainText(sender);
  } finally {
    const {
      data: rows,
    } =
      await localSupabaseAdmin
        .from("memories")
        .select(
          "id,audio_path"
        )
        .eq(
          "order_number",
          orderNumber
        );

    const paths =
      (rows ?? [])
        .map(
          (row) =>
            row.audio_path
        )
        .filter(
          (
            path
          ): path is string =>
            Boolean(path)
        );

    if (
      audioPath &&
      !paths.includes(audioPath)
    ) {
      paths.push(audioPath);
    }

    if (paths.length > 0) {
      await localSupabaseAdmin
        .storage
        .from("voice-notes")
        .remove(paths);
    }

    await localSupabaseAdmin
      .from("memories")
      .delete()
      .eq(
        "order_number",
        orderNumber
      );
  }
});
