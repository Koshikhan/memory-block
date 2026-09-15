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

test("customer can upload voice later and memory becomes ready", async ({
  page,
  browser,
}) => {
  const unique =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const orderNumber =
    `E2E-LATER-${unique}`;

  const customerName =
    `E2E Customer ${unique}`;

  const sender =
    `E2E Sender ${unique}`;

  const recipient =
    `E2E Recipient ${unique}`;

  let memoryId:
    | string
    | null = null;

  let audioPath:
    | string
    | null = null;

  try {
    /*
     * STEP 1
     * Staff creates a pending order.
     */
    await page.goto("/");

    await page
      .getByLabel("Order number")
      .fill(orderNumber);

    await page
      .getByLabel("Customer name")
      .fill(customerName);

    await page
      .getByLabel("Email")
      .fill("customer@example.com");

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
        "Customer upload E2E test."
      );

    await page
      .getByRole("button", {
        name: /Customer uploads later/,
      })
      .click();

    await page
      .getByRole("button", {
        name:
          "Create order & upload link",
      })
      .click();

    let pendingMemory:
      | {
          id: string;
          upload_token: string | null;
          public_code: string;
          status: string;
          upload_source: string;
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
                [
                  "id",
                  "upload_token",
                  "public_code",
                  "status",
                  "upload_source",
                ].join(",")
              )
              .eq(
                "order_number",
                orderNumber
              )
              .maybeSingle();

          if (error) {
            throw error;
          }

          pendingMemory = data;

          return data?.status;
        },
        {
          timeout: 10_000,
        }
      )
      .toBe(
        "WAITING_FOR_UPLOAD"
      );

    expect(
      pendingMemory
    ).not.toBeNull();

    expect(
      pendingMemory!.upload_source
    ).toBe("PRIVATE_LINK");

    expect(
      pendingMemory!.upload_token
    ).toBeTruthy();

    memoryId =
      pendingMemory!.id;

    /*
     * STEP 2
     * Simulate customer opening
     * the private link.
     *
     * Use a fresh browser context so
     * this customer is NOT logged in
     * as staff.
     */
    const customerContext =
      await browser.newContext();

    const customerPage =
      await customerContext.newPage();

    try {
      await customerPage.goto(
        `/upload/${pendingMemory!.upload_token}`
      );

      await expect(
        customerPage.getByRole(
          "heading",
          {
            name:
              "Add your voice memory",
          }
        )
      ).toBeVisible();

      await expect(
        customerPage.locator("body")
      ).toContainText(recipient);

      /*
       * Customer chooses audio.
       */
      const fileInput =
        customerPage.locator(
          'input[type="file"]'
        );

      await fileInput.setInputFiles({
        name:
          "customer-recording.wav",
        mimeType: "audio/wav",
        buffer: createTestWav(),
      });

      await expect(
        customerPage.getByText(
          "Your recording",
          { exact: true }
        )
      ).toBeVisible();

      await expect(
        customerPage.getByText(
          "customer-recording.wav"
        )
      ).toBeVisible();

      /*
       * Customer submits.
       */
      await customerPage
        .getByRole("button", {
          name:
            "Submit voice memory",
        })
        .click();

      await expect(
        customerPage.getByRole(
          "heading",
          {
            name:
              "Voice memory received",
          }
        )
      ).toBeVisible({
        timeout: 15_000,
      });

      /*
       * STEP 3
       * Verify DB transitioned to READY.
       */
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
                  "status,audio_path"
                )
                .eq(
                  "id",
                  pendingMemory!.id
                )
                .single();

            if (error) {
              throw error;
            }

            audioPath =
              data.audio_path;

            return data.status;
          },
          {
            timeout: 10_000,
          }
        )
        .toBe("READY");

      expect(
        audioPath
      ).toBeTruthy();

      /*
       * STEP 4
       * Opening the same upload link
       * again should show completed.
       */
      await customerPage.reload();

      await expect(
        customerPage.getByRole(
          "heading",
          {
            name:
              "Voice memory received",
          }
        )
      ).toBeVisible();

      /*
       * STEP 5
       * Recipient memory page works.
       */
      await customerPage.goto(
        `/memory/${pendingMemory!.public_code}`
      );

      await expect(
        customerPage.locator("body")
      ).toContainText(recipient);

      await expect(
        customerPage.locator("body")
      ).toContainText(sender);
    } finally {
      await customerContext.close();
    }
  } finally {
    /*
     * CLEANUP
     * Local Supabase only.
     */
    if (memoryId) {
      const {
        data,
      } =
        await localSupabaseAdmin
          .from("memories")
          .select("audio_path")
          .eq("id", memoryId)
          .maybeSingle();

      if (
        data?.audio_path &&
        !audioPath
      ) {
        audioPath =
          data.audio_path;
      }
    }

    if (audioPath) {
      await localSupabaseAdmin
        .storage
        .from("voice-notes")
        .remove([audioPath]);
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
