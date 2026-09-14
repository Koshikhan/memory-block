import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type Action = "assign" | "activate";

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

async function getAuthenticatedUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      ),
    };
  }

  const accessToken = authorization
    .slice("Bearer ".length)
    .trim();

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth.user) {
      return auth.response!;
    }

    const body = await request.json().catch(() => null);

    const action = String(body?.action ?? "") as Action;
    const memoryId = normalizeId(body?.memoryId);
    const qrCodeValue = normalizeCode(body?.qrCode);

    if (action !== "assign" && action !== "activate") {
      return NextResponse.json(
        { error: "Action must be assign or activate." },
        { status: 400 }
      );
    }

    if (!memoryId) {
      return NextResponse.json(
        { error: "Memory ID is required." },
        { status: 400 }
      );
    }

    if (!qrCodeValue) {
      return NextResponse.json(
        { error: "QR code is required." },
        { status: 400 }
      );
    }

    const {
      data: memory,
      error: memoryError,
    } = await supabaseAdmin
      .from("memories")
      .select(`
        id,
        created_by,
        order_number,
        status,
        audio_path,
        public_code
      `)
      .eq("id", memoryId)
      .eq("created_by", auth.user.id)
      .maybeSingle();

    if (memoryError) {
      console.error(
        "Unable to load memory for QR assignment:",
        memoryError
      );

      return NextResponse.json(
        { error: "Unable to load this order." },
        { status: 500 }
      );
    }

    if (!memory) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (memory.status !== "READY" || !memory.audio_path) {
      return NextResponse.json(
        {
          error:
            "The order must be READY with a voice recording before a pre-printed QR can be assigned.",
        },
        { status: 409 }
      );
    }

    const {
      data: qrCode,
      error: qrError,
    } = await supabaseAdmin
      .from("qr_codes")
      .select(`
        id,
        code,
        status,
        memory_id,
        assigned_at,
        activated_at
      `)
      .eq("code", qrCodeValue)
      .eq("created_by", auth.user.id)
      .maybeSingle();

    if (qrError) {
      console.error(
        "Unable to load QR code:",
        qrError
      );

      return NextResponse.json(
        { error: "Unable to load this QR code." },
        { status: 500 }
      );
    }

    if (!qrCode) {
      return NextResponse.json(
        {
          error:
            "QR code not found in your inventory.",
        },
        { status: 404 }
      );
    }

    if (action === "assign") {
      if (
        (qrCode.status === "ASSIGNED" ||
          qrCode.status === "ACTIVE") &&
        qrCode.memory_id === memory.id
      ) {
        return NextResponse.json({
          qrCode,
          memory: {
            id: memory.id,
            orderNumber: memory.order_number,
          },
        });
      }

      if (qrCode.status !== "AVAILABLE") {
        return NextResponse.json(
          {
            error:
              qrCode.status === "VOID"
                ? "This QR code has been voided and cannot be assigned."
                : "This QR code is already assigned to another order.",
          },
          { status: 409 }
        );
      }

      const {
        data: existingLiveQr,
        error: existingLiveQrError,
      } = await supabaseAdmin
        .from("qr_codes")
        .select(`
          id,
          code,
          status
        `)
        .eq("created_by", auth.user.id)
        .eq("memory_id", memory.id)
        .in("status", ["ASSIGNED", "ACTIVE"])
        .maybeSingle();

      if (existingLiveQrError) {
        console.error(
          "Unable to check existing order QR:",
          existingLiveQrError
        );

        return NextResponse.json(
          {
            error:
              "Unable to check whether this order already has a pre-printed QR.",
          },
          { status: 500 }
        );
      }

      if (existingLiveQr) {
        return NextResponse.json(
          {
            error: `This order already has QR ${existingLiveQr.code} (${existingLiveQr.status}).`,
          },
          { status: 409 }
        );
      }

      const assignedAt = new Date().toISOString();

      const {
        data: assignedQr,
        error: assignError,
      } = await supabaseAdmin
        .from("qr_codes")
        .update({
          status: "ASSIGNED",
          memory_id: memory.id,
          assigned_at: assignedAt,
          activated_at: null,
        })
        .eq("id", qrCode.id)
        .eq("created_by", auth.user.id)
        .eq("status", "AVAILABLE")
        .is("memory_id", null)
        .select(`
          id,
          code,
          status,
          memory_id,
          assigned_at,
          activated_at
        `)
        .maybeSingle();

      if (assignError) {
        console.error(
          "QR assignment failed:",
          assignError
        );

        return NextResponse.json(
          {
            error:
              "Unable to assign this QR code. It may already be in use.",
          },
          { status: 409 }
        );
      }

      if (!assignedQr) {
        return NextResponse.json(
          {
            error:
              "This QR code is no longer available. Refresh and try another code.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        qrCode: assignedQr,
        memory: {
          id: memory.id,
          orderNumber: memory.order_number,
        },
      });
    }

    if (
      qrCode.status === "ACTIVE" &&
      qrCode.memory_id === memory.id
    ) {
      return NextResponse.json({
        qrCode,
        memory: {
          id: memory.id,
          orderNumber: memory.order_number,
          publicCode: memory.public_code,
        },
      });
    }

    if (
      qrCode.status !== "ASSIGNED" ||
      qrCode.memory_id !== memory.id
    ) {
      return NextResponse.json(
        {
          error:
            "This QR code must be assigned to this order before it can be activated.",
        },
        { status: 409 }
      );
    }

    const activatedAt = new Date().toISOString();

    const {
      data: activatedQr,
      error: activateError,
    } = await supabaseAdmin
      .from("qr_codes")
      .update({
        status: "ACTIVE",
        activated_at: activatedAt,
      })
      .eq("id", qrCode.id)
      .eq("created_by", auth.user.id)
      .eq("memory_id", memory.id)
      .eq("status", "ASSIGNED")
      .select(`
        id,
        code,
        status,
        memory_id,
        assigned_at,
        activated_at
      `)
      .maybeSingle();

    if (activateError) {
      console.error(
        "QR activation failed:",
        activateError
      );

      return NextResponse.json(
        { error: "Unable to activate this QR code." },
        { status: 500 }
      );
    }

    if (!activatedQr) {
      return NextResponse.json(
        {
          error:
            "This QR code could not be activated. Refresh the order and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      qrCode: activatedQr,
      memory: {
        id: memory.id,
        orderNumber: memory.order_number,
        publicCode: memory.public_code,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected QR assignment error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected error while updating the QR assignment.",
      },
      { status: 500 }
    );
  }
}
