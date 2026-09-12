import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
};

const SHOP_OWNER_USER_ID =
  process.env.SHOP_OWNER_USER_ID;

function clean(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function POST(request: Request) {
  if (!SHOP_OWNER_USER_ID) {
    console.error(
      "SHOP_OWNER_USER_ID is missing."
    );

    return NextResponse.json(
      {
        error:
          "The shop submission service is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  let body: {
    action?: string;

    fileName?: string;
    fileSize?: number;

    submissionId?: string;
    path?: string;

    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;

    recipientName?: string;
    message?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * STEP 1
   *
   * Prepare a private storage location
   * and signed upload token.
   */
  if (body.action === "prepare") {
    const fileName =
      clean(body.fileName);

    const fileSize =
      Number(body.fileSize);

    if (!fileName) {
      return NextResponse.json(
        {
          error:
            "Recording filename is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "Choose a non-empty recording up to 25 MB.",
        },
        {
          status: 400,
        }
      );
    }

    const extension =
      fileName
        .split(".")
        .pop()
        ?.toLowerCase() ?? "";

    const contentType =
      AUDIO_TYPES[extension];

    if (!contentType) {
      return NextResponse.json(
        {
          error:
            "Choose an MP3, M4A, WAV, OGG, OPUS or WebM recording.",
        },
        {
          status: 400,
        }
      );
    }

    const submissionId =
      crypto.randomUUID();

    const objectName =
      `${crypto.randomUUID()}.${extension}`;

    /*
     * The path starts with the shop owner's
     * Supabase user ID so it satisfies the
     * existing audio_belongs_to_creator
     * database constraint.
     */
    const path =
      `${SHOP_OWNER_USER_ID}/shop-uploads/${submissionId}/${objectName}`;

    const {
      data: signedUpload,
      error: signedUploadError,
    } = await supabaseAdmin.storage
      .from("voice-notes")
      .createSignedUploadUrl(path);

    if (
      signedUploadError ||
      !signedUpload?.token
    ) {
      console.error(
        "Shop signed upload failed:",
        signedUploadError
      );

      return NextResponse.json(
        {
          error:
            "Unable to prepare your recording upload.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      submissionId,
      path,
      token: signedUpload.token,
      contentType,
    });
  }

  /*
   * STEP 2
   *
   * Recording has successfully reached
   * private Supabase Storage.
   *
   * Now create the actual Memory Block order.
   */
  if (body.action === "complete") {
    const submissionId =
      clean(body.submissionId);

    const path =
      clean(body.path);

    const customerName =
      clean(body.customerName);

    const customerEmail =
      clean(body.customerEmail);

    const customerPhone =
      clean(body.customerPhone);

    const recipientName =
      clean(body.recipientName);

    const message =
      clean(body.message);

    if (
      !submissionId ||
      !path
    ) {
      return NextResponse.json(
        {
          error:
            "The recording submission is incomplete.",
        },
        {
          status: 400,
        }
      );
    }

    if (!customerName) {
      return NextResponse.json(
        {
          error:
            "Enter your name.",
        },
        {
          status: 400,
        }
      );
    }

    if (!recipientName) {
      return NextResponse.json(
        {
          error:
            "Enter who this memory is for.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      customerName.length > 80 ||
      recipientName.length > 80
    ) {
      return NextResponse.json(
        {
          error:
            "Names must be 80 characters or fewer.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      customerEmail.length > 254
    ) {
      return NextResponse.json(
        {
          error:
            "Email address is too long.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      customerPhone.length > 30
    ) {
      return NextResponse.json(
        {
          error:
            "Mobile number is too long.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      message.length > 500
    ) {
      return NextResponse.json(
        {
          error:
            "Your message must be 500 characters or fewer.",
        },
        {
          status: 400,
        }
      );
    }

    const expectedFolder =
      `${SHOP_OWNER_USER_ID}/shop-uploads/${submissionId}`;

    if (
      !path.startsWith(
        `${expectedFolder}/`
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid recording path.",
        },
        {
          status: 400,
        }
      );
    }

    const fileName =
      path.substring(
        expectedFolder.length + 1
      );

    if (!fileName) {
      return NextResponse.json(
        {
          error:
            "Recording filename is missing.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Confirm the uploaded recording
     * actually exists.
     */
    const {
      data: storedFiles,
      error: storageError,
    } = await supabaseAdmin.storage
      .from("voice-notes")
      .list(expectedFolder, {
        search: fileName,
        limit: 10,
      });

    if (storageError) {
      console.error(
        "Shop storage verification failed:",
        storageError
      );

      return NextResponse.json(
        {
          error:
            "Unable to confirm the recording upload.",
        },
        {
          status: 500,
        }
      );
    }

    const fileExists =
      storedFiles?.some(
        (file) =>
          file.name === fileName
      ) ?? false;

    if (!fileExists) {
      return NextResponse.json(
        {
          error:
            "The recording could not be found. Please try again.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Make retries safe.
     *
     * If the browser sends "complete"
     * more than once, return the already
     * created order instead of duplicating it.
     */
    const {
      data: existingMemory,
      error: existingError,
    } = await supabaseAdmin
      .from("memories")
      .select(`
        id,
        order_number,
        public_code,
        status,
        upload_source
      `)
      .eq("id", submissionId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing shop memory lookup failed:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify this submission.",
        },
        {
          status: 500,
        }
      );
    }

    if (existingMemory) {
      if (
        existingMemory.upload_source !==
        "SHOP_QR"
      ) {
        return NextResponse.json(
          {
            error:
              "This submission could not be completed.",
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json({
        success: true,
        id: existingMemory.id,
        orderNumber:
          existingMemory.order_number,
        publicCode:
          existingMemory.public_code,
        status:
          existingMemory.status,
      });
    }

    const publicCode =
      crypto.randomUUID();

    /*
     * order_number is deliberately omitted.
     *
     * The database sequence/default we added
     * generates MB-1001, MB-1002, etc.
     */
    const {
      data: createdMemory,
      error: createError,
    } = await supabaseAdmin
      .from("memories")
      .insert({
        id:
          submissionId,

        public_code:
          publicCode,

        created_by:
          SHOP_OWNER_USER_ID,

        customer_name:
          customerName,

        customer_email:
          customerEmail || null,

        customer_phone:
          customerPhone || null,

        /*
         * For an in-store self-service
         * submission, the customer is
         * also the sender.
         */
        sender_name:
          customerName,

        recipient_name:
          recipientName,

        message,

        audio_path:
          path,

        status:
          "READY",

        uploaded_at:
          new Date().toISOString(),

        upload_source:
          "SHOP_QR",

        upload_token:
          null,

        upload_expires_at:
          null,

        label_printed_at:
          null,
      })
      .select(`
        id,
        order_number,
        public_code,
        status
      `)
      .single();

    if (
      createError ||
      !createdMemory
    ) {
      console.error(
        "Shop order creation failed:",
        createError
      );

      /*
       * Best-effort cleanup so a failed
       * database insert does not leave
       * an unnecessary recording behind.
       */
      await supabaseAdmin.storage
        .from("voice-notes")
        .remove([path]);

      return NextResponse.json(
        {
          error:
            "Your recording uploaded, but the Memory Block order could not be created. Please ask a member of staff for help.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,

      id:
        createdMemory.id,

      orderNumber:
        createdMemory.order_number,

      publicCode:
        createdMemory.public_code,

      status:
        createdMemory.status,
    });
  }

  return NextResponse.json(
    {
      error:
        "Unknown shop submission action.",
    },
    {
      status: 400,
    }
  );
}
