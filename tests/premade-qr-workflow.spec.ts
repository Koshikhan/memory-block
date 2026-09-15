import {
  test,
  expect,
} from "@playwright/test";

import {
  createClient,
} from "@supabase/supabase-js";

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

test("customer can activate a pre-made QR Memory Block", async ({
  browser,
  request,
}) => {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const publishableKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const staffEmail =
    process.env.TEST_STAFF_EMAIL;

  const staffPassword =
    process.env.TEST_STAFF_PASSWORD;

  if (
    !supabaseUrl ||
    !publishableKey ||
    !staffEmail ||
    !staffPassword
  ) {
    throw new Error(
      "Missing local E2E environment variables."
    );
  }

  if (
    !supabaseUrl.includes("127.0.0.1") &&
    !supabaseUrl.includes("localhost")
  ) {
    throw new Error(
      `Refusing non-local E2E run: ${supabaseUrl}`
    );
  }

  const unique =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const customerName =
    `Premade E2E ${unique}`;

  const recipient =
    `Recipient ${unique}`;

  const phone =
    "07700123456";

  let batchId:
    | string
    | null = null;

  let qrCode:
    | string
    | null = null;

  let memoryId:
    | string
    | null = null;

  let audioPath:
    | string
    | null = null;

  /*
   * Authenticate directly with the
   * LOCAL Supabase project so we can
   * call the real QR batch API.
   */
  const authClient =
    createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  try {
    const {
      data: authData,
      error: authError,
    } =
      await authClient.auth
        .signInWithPassword({
          email: staffEmail,
          password: staffPassword,
        });

    if (
      authError ||
      !authData.session
    ) {
      throw (
        authError ??
        new Error(
          "Unable to authenticate test staff."
        )
      );
    }

    /*
     * STEP 1
     * Staff generates a real QR batch
     * through the application API.
     */
    const batchResponse =
      await request.post(
        "/api/qr-batches",
        {
          headers: {
            Authorization:
              `Bearer ${authData.session.access_token}`,
          },
          data: {
            quantity: 20,
          },
        }
      );

    expect(
      batchResponse.status()
    ).toBe(201);

    const batchResult =
      await batchResponse.json();

    expect(
      batchResult.codes
    ).toHaveLength(20);

    batchId =
      batchResult.batch.id;

    qrCode =
      batchResult.codes[0].code;

    expect(qrCode).toMatch(
      /^[A-Z0-9]{10}$/
    );

    /*
     * Confirm QR begins AVAILABLE.
     */
    const {
      data: initialQr,
      error: initialQrError,
    } =
      await localSupabaseAdmin
        .from("qr_codes")
        .select(
          "id,code,status,memory_id"
        )
        .eq(
          "code",
          qrCode
        )
        .single();

    if (initialQrError) {
      throw initialQrError;
    }

    expect(
      initialQr.status
    ).toBe("AVAILABLE");

    expect(
      initialQr.memory_id
    ).toBeNull();

    /*
     * STEP 2
     * Public customer scans the
     * pre-printed physical QR.
     */
    const customerContext =
      await browser.newContext();

    const page =
      await customerContext.newPage();

    try {
      await page.goto(
        `/q/${qrCode}`
      );

      /*
       * The current component does not
       * associate every visible label
       * with its input, so use stable
       * input types/order here.
       */
      const textInputs =
        page.locator(
          'input[type="text"]'
        );

      await textInputs
        .nth(0)
        .fill(customerName);

      await textInputs
        .nth(1)
        .fill(recipient);

      await page
        .locator(
          'input[type="tel"]'
        )
        .fill(phone);

      await page
        .locator(
          'input[type="email"]'
        )
        .fill(
          "premade-e2e@example.com"
        );

      /*
       * Intentionally leave the
       * optional short message blank.
       *
       * This protects the previous
       * memories.message NOT NULL bug.
       */
      await expect(
        page.locator("textarea")
      ).toHaveValue("");

      await page
        .locator(
          'input[type="file"]'
        )
        .setInputFiles({
          name:
            "premade-recording.mp3",
          mimeType:
            "audio/mpeg",
          buffer:
            createTestWav(),
        });

      await expect(
        page.getByRole(
          "button",
          {
            name:
              "Activate my Memory Block",
          }
        )
      ).toBeEnabled();

      await page
        .getByRole(
          "button",
          {
            name:
              "Activate my Memory Block",
          }
        )
        .click();

      /*
       * Customer sees activation success.
       */
      await expect(
        page.getByRole(
          "heading",
          {
            name:
              "Your voice memory has been added",
          }
        )
      ).toBeVisible({
        timeout: 15_000,
      });

      /*
       * STEP 3
       * Verify QR became ACTIVE.
       */
      let activeQr:
        | {
            status: string;
            memory_id: string | null;
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
                .from("qr_codes")
                .select(
                  "status,memory_id"
                )
                .eq(
                  "code",
                  qrCode!
                )
                .single();

            if (error) {
              throw error;
            }

            activeQr = data;

            return data.status;
          },
          {
            timeout: 10_000,
          }
        )
        .toBe("ACTIVE");

      expect(
        activeQr!.memory_id
      ).toBeTruthy();

      memoryId =
        activeQr!.memory_id;

      /*
       * STEP 4
       * Verify the linked Memory.
       */
      const {
        data: memory,
        error: memoryError,
      } =
        await localSupabaseAdmin
          .from("memories")
          .select(
            "id,order_number,public_code,status,upload_source,audio_path,message,customer_name,customer_phone,sender_name,recipient_name"
          )
          .eq(
            "id",
            memoryId!
          )
          .single();

      if (memoryError) {
        throw memoryError;
      }

      audioPath =
        memory.audio_path;

      expect(
        memory.status
      ).toBe("READY");

      expect(
        memory.upload_source
      ).toBe("PREMADE_QR");

      expect(
        memory.order_number
      ).toMatch(/^MB-\d+$/);

      expect(
        memory.audio_path
      ).toBeTruthy();

      expect(
        memory.customer_name
      ).toBe(customerName);

      expect(
        memory.customer_phone
      ).toBe(phone);

      expect(
        memory.sender_name
      ).toBe(customerName);

      expect(
        memory.recipient_name
      ).toBe(recipient);

      /*
       * Critical regression:
       * blank optional message must be
       * stored as "" rather than NULL.
       */
      expect(
        memory.message
      ).toBe("");

      /*
       * STEP 5
       * Test the SAME physical QR after
       * activation.
       */
      await page
        .getByRole("link", {
          name:
            "Test this Memory Block",
        })
        .click();

      await expect(page).toHaveURL(
        /\/memory\/.+$/,
        {
          timeout: 10_000,
        }
      );

      await expect(
        page.locator("body")
      ).toContainText(recipient);

      await expect(
        page.locator("body")
      ).toContainText(customerName);
    } finally {
      await customerContext.close();
    }
  } finally {
    /*
     * Recover linked data even if the
     * test fails halfway through.
     */
    if (
      qrCode &&
      !memoryId
    ) {
      const {
        data,
      } =
        await localSupabaseAdmin
          .from("qr_codes")
          .select("memory_id")
          .eq(
            "code",
            qrCode
          )
          .maybeSingle();

      memoryId =
        data?.memory_id ??
        null;
    }

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

    /*
     * Delete QR batch first.
     * qr_codes cascade from the batch.
     *
     * This must happen before deleting
     * an ACTIVE linked memory because
     * the QR state constraint requires
     * ACTIVE rows to have memory_id.
     */
    if (batchId) {
      await localSupabaseAdmin
        .from("qr_batches")
        .delete()
        .eq(
          "id",
          batchId
        );
    }

    if (memoryId) {
      await localSupabaseAdmin
        .from("memories")
        .delete()
        .eq(
          "id",
          memoryId
        );
    }

    /*
     * Fallback cleanup if activation
     * created a memory before we captured
     * its id.
     */
    await localSupabaseAdmin
      .from("memories")
      .delete()
      .eq(
        "customer_name",
        customerName
      );

    await authClient.auth.signOut({
      scope: "local",
    });
  }
});
