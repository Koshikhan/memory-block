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
  buffer.writeUInt32LE(sampleRate, 24);
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

test("customer can create a memory from the permanent shop QR page", async ({
  browser,
}) => {
  const unique =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const customerName =
    `Shop E2E ${unique}`;

  const recipient =
    `Recipient ${unique}`;

  const phone =
    "07700123456";

  let memoryId:
    | string
    | null = null;

  let audioPath:
    | string
    | null = null;

  const context =
    await browser.newContext();

  const page =
    await context.newPage();

  try {
    await page.goto(
      "/add-memory"
    );

    await page
      .getByPlaceholder("Your name")
      .fill(customerName);

    await page
      .getByLabel(
        "Who is this memory for?"
      )
      .fill(recipient);

    await page
      .getByLabel("Mobile number")
      .fill(phone);

    await page
      .getByLabel(/Email/)
      .fill(
        "shop-e2e@example.com"
      );

    await page
      .getByLabel(/Short message/)
      .fill(
        "Permanent shop QR automated test."
      );

    await page
      .locator(
        'input[type="file"]'
      )
      .setInputFiles({
        name:
          "shop-recording.wav",
        mimeType: "audio/wav",
        buffer: createTestWav(),
      });

    await expect(
      page.getByRole(
        "button",
        {
          name:
            "Submit my memory",
        }
      )
    ).toBeEnabled();

    await page
      .getByRole(
        "button",
        {
          name:
            "Submit my memory",
        }
      )
      .click();

    let memory:
      | {
          id: string;
          order_number: string | null;
          public_code: string;
          status: string;
          upload_source: string;
          audio_path: string | null;
          customer_name: string | null;
          customer_phone: string | null;
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
                "id,order_number,public_code,status,upload_source,audio_path,customer_name,customer_phone,sender_name,recipient_name"
              )
              .eq(
                "customer_name",
                customerName
              )
              .maybeSingle();

          if (error) {
            throw error;
          }

          memory = data;

          return data?.status;
        },
        {
          timeout: 15_000,
        }
      )
      .toBe("READY");

    expect(memory).not.toBeNull();

    memoryId =
      memory!.id;

    audioPath =
      memory!.audio_path;

    expect(
      memory!.upload_source
    ).toBe("SHOP_QR");

    expect(
      memory!.order_number
    ).toMatch(/^MB-\d+$/);

    expect(
      memory!.audio_path
    ).toBeTruthy();

    expect(
      memory!.customer_name
    ).toBe(customerName);

    expect(
      memory!.customer_phone
    ).toBe(phone);

    expect(
      memory!.recipient_name
    ).toBe(recipient);

    expect(
      memory!.sender_name
    ).toBe(customerName);

    await page.goto(
      `/memory/${memory!.public_code}`
    );

    await expect(
      page.locator("body")
    ).toContainText(recipient);

    await expect(
      page.locator("body")
    ).toContainText(customerName);
  } finally {
    if (
      memoryId &&
      !audioPath
    ) {
      const {
        data,
      } =
        await localSupabaseAdmin
          .from("memories")
          .select("audio_path")
          .eq(
            "id",
            memoryId
          )
          .maybeSingle();

      audioPath =
        data?.audio_path ??
        null;
    }

    if (audioPath) {
      await localSupabaseAdmin
        .storage
        .from("voice-notes")
        .remove([
          audioPath,
        ]);
    }

    await localSupabaseAdmin
      .from("memories")
      .delete()
      .eq(
        "customer_name",
        customerName
      );

    await context.close();
  }
});
