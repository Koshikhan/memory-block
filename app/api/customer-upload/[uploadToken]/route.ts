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

type RouteContext = {
  params: Promise<{
    uploadToken: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  const { uploadToken } = await context.params;

  const { data: memory, error: memoryError } =
    await supabaseAdmin
      .from("memories")
      .select(
        `
          id,
          created_by,
          status,
          audio_path,
          upload_expires_at
        `
      )
      .eq("upload_token", uploadToken)
      .maybeSingle();

  if (memoryError) {
    console.error(
      "Upload lookup failed:",
      memoryError
    );

    return NextResponse.json(
      {
        error:
          "Unable to verify this upload link.",
      },
      {
        status: 500,
      }
    );
  }

  if (!memory) {
    return NextResponse.json(
      {
        error:
          "This upload link is invalid.",
      },
      {
        status: 404,
      }
    );
  }

  if (!memory.created_by) {
    console.error(
      "Memory has no created_by value:",
      memory.id
    );

    return NextResponse.json(
      {
        error:
          "This order is missing its staff owner.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    memory.status === "READY" ||
    memory.audio_path
  ) {
    return NextResponse.json(
      {
        error:
          "A voice message has already been submitted for this order.",
      },
      {
        status: 409,
      }
    );
  }

  if (
    memory.upload_expires_at &&
    new Date(
      memory.upload_expires_at
    ).getTime() < Date.now()
  ) {
    return NextResponse.json(
      {
        error:
          "This upload link has expired.",
      },
      {
        status: 410,
      }
    );
  }

  if (
    memory.status !==
    "WAITING_FOR_UPLOAD"
  ) {
    return NextResponse.json(
      {
        error:
          "This order is not accepting uploads.",
      },
      {
        status: 409,
      }
    );
  }

  let body: {
    action?: string;
    fileName?: string;
    fileSize?: number;
    path?: string;
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
   * Customer asks for permission to upload.
   */
  if (body.action === "prepare") {
    const fileName =
      typeof body.fileName === "string"
        ? body.fileName.trim()
        : "";

    const fileSize = Number(
      body.fileSize
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

    const objectName =
      `${crypto.randomUUID()}.${extension}`;

    /*
     * IMPORTANT:
     * The first folder must be the staff user's ID.
     *
     * This satisfies the existing
     * audio_belongs_to_creator database constraint.
     *
     * Result:
     *
     * STAFF_USER_ID/
     *   customer-uploads/
     *     MEMORY_ID/
     *       recording.m4a
     */
    const path =
      `${memory.created_by}/customer-uploads/${memory.id}/${objectName}`;

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
        "Signed upload URL failed:",
        signedUploadError
      );

      return NextResponse.json(
        {
          error:
            "Unable to prepare the recording upload.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      path,
      token: signedUpload.token,
      contentType,
    });
  }

  /*
   * STEP 2
   * Customer has uploaded.
   * Verify the file exists and mark
   * the memory READY.
   */
  if (body.action === "complete") {
    const path =
      typeof body.path === "string"
        ? body.path
        : "";

    const expectedFolder =
      `${memory.created_by}/customer-uploads/${memory.id}`;

    /*
     * Prevent the browser from trying
     * to complete another memory or
     * reference another storage path.
     */
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
     * Confirm the recording really
     * exists in Supabase Storage
     * before updating the database.
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
        "Storage verification failed:",
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
            "The recording could not be found. Please try uploading again.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Mark this memory as READY.
     *
     * The conditional filters also
     * prevent a second request from
     * replacing an already-completed
     * recording.
     */
    const {
      data: updatedMemory,
      error: updateError,
    } = await supabaseAdmin
      .from("memories")
      .update({
        audio_path: path,
        status: "READY",
        uploaded_at:
          new Date().toISOString(),
      })
      .eq("id", memory.id)
      .eq(
        "status",
        "WAITING_FOR_UPLOAD"
      )
      .is("audio_path", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error(
        "Memory completion failed:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "The recording uploaded, but the order could not be completed.",
        },
        {
          status: 500,
        }
      );
    }

    if (!updatedMemory) {
      return NextResponse.json(
        {
          error:
            "This order has already been completed.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json({
      success: true,
      status: "READY",
    });
  }

  return NextResponse.json(
    {
      error:
        "Unknown upload action.",
    },
    {
      status: 400,
    }
  );
}