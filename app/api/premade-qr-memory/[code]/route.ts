import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const EXTENSIONS = new Set(["mp3", "m4a", "mp4", "wav", "ogg", "opus", "webm"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function extensionOf(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() ?? "" : "";
}

function contentType(extension: string) {
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "m4a" || extension === "mp4") return "audio/mp4";
  if (extension === "wav") return "audio/wav";
  if (extension === "ogg" || extension === "opus") return "audio/ogg";
  if (extension === "webm") return "audio/webm";
  return "application/octet-stream";
}

async function removeAudio(path: string) {
  await supabaseAdmin.storage.from("voice-notes").remove([path]);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const qrValue = code.trim().toUpperCase();
    const body = await request.json().catch(() => null);
    const action = text(body?.action);

    const { data: qr, error: qrError } = await supabaseAdmin
      .from("qr_codes")
      .select("id,code,created_by,status,memory_id")
      .eq("code", qrValue)
      .maybeSingle();

    if (qrError) {
      console.error(qrError);
      return NextResponse.json({ error: "Unable to load this QR code." }, { status: 500 });
    }

    if (!qr) {
      return NextResponse.json({ error: "This QR code does not exist." }, { status: 404 });
    }

    if (action === "prepare") {
      if (qr.status !== "AVAILABLE") {
        return NextResponse.json(
          {
            error:
              qr.status === "ACTIVE"
                ? "This Memory Block has already been activated."
                : qr.status === "VOID"
                  ? "This QR code is no longer active."
                  : "This Memory Block is already being prepared.",
          },
          { status: 409 }
        );
      }

      const fileName = text(body?.fileName);
      const fileSize = Number(body?.fileSize);
      const ext = extensionOf(fileName);

      if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Choose a voice recording no larger than 25 MB." },
          { status: 400 }
        );
      }

      if (!EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: "Unsupported audio format." },
          { status: 400 }
        );
      }

      const submissionId = crypto.randomUUID();
      const objectName = `${crypto.randomUUID()}.${ext}`;
      const path =
        `${qr.created_by}/premade-qr/${qr.id}/${submissionId}/${objectName}`;

      const { data, error } = await supabaseAdmin.storage
        .from("voice-notes")
        .createSignedUploadUrl(path);

      if (error || !data) {
        console.error(error);
        return NextResponse.json(
          { error: "Unable to prepare the voice upload." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        submissionId,
        path,
        token: data.token,
        contentType: contentType(ext),
      });
    }

    if (action === "complete") {
      const submissionId = text(body?.submissionId);
      const path = text(body?.path);
      const customerName = text(body?.customerName);
      const customerEmail = text(body?.customerEmail);
      const customerPhone = text(body?.customerPhone);
      const recipientName = text(body?.recipientName);
      const message = text(body?.message);

      if (!submissionId || !path) {
        return NextResponse.json({ error: "Upload information is missing." }, { status: 400 });
      }

      if (!customerName || !recipientName || !customerPhone) {
        return NextResponse.json(
          { error: "Your name, recipient name, and mobile number are required." },
          { status: 400 }
        );
      }

      if (
        customerName.length > 120 ||
        recipientName.length > 120 ||
        customerEmail.length > 254 ||
        customerPhone.length > 50 ||
        message.length > 2000
      ) {
        return NextResponse.json({ error: "One or more fields are too long." }, { status: 400 });
      }

      if (qr.status === "ACTIVE" && qr.memory_id === submissionId) {
        const { data: existing } = await supabaseAdmin
          .from("memories")
          .select("id,order_number,public_code,status")
          .eq("id", submissionId)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ memory: existing, qrCode: qr });
        }
      }

      if (qr.status !== "AVAILABLE") {
        await removeAudio(path);
        return NextResponse.json(
          { error: "This Memory Block is no longer available for activation." },
          { status: 409 }
        );
      }

      const folder = `${qr.created_by}/premade-qr/${qr.id}/${submissionId}`;

      if (!path.startsWith(`${folder}/`)) {
        return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
      }

      const objectName = path.slice(folder.length + 1);

      if (!objectName || objectName.includes("/")) {
        return NextResponse.json({ error: "Invalid uploaded file." }, { status: 400 });
      }

      const { data: files, error: listError } = await supabaseAdmin.storage
        .from("voice-notes")
        .list(folder, { search: objectName, limit: 10 });

      if (listError || !files?.some((file) => file.name === objectName)) {
        return NextResponse.json(
          { error: "The uploaded voice recording could not be verified." },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();

      const { data: memory, error: memoryError } = await supabaseAdmin
        .from("memories")
        .insert({
          id: submissionId,
          public_code: crypto.randomUUID(),
          created_by: qr.created_by,
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone,
          sender_name: customerName,
          recipient_name: recipientName,
          message: message || null,
          audio_path: path,
          status: "READY",
          uploaded_at: now,
          upload_source: "PREMADE_QR",
          upload_token: null,
          upload_expires_at: null,
          label_printed_at: null,
        })
        .select("id,order_number,public_code,status")
        .single();

      if (memoryError || !memory) {
        console.error(memoryError);
        await removeAudio(path);
        return NextResponse.json(
          { error: "Unable to create your Memory Block order." },
          { status: 500 }
        );
      }

      const { data: activeQr, error: activateError } = await supabaseAdmin
        .from("qr_codes")
        .update({
          status: "ACTIVE",
          memory_id: memory.id,
          assigned_at: now,
          activated_at: now,
        })
        .eq("id", qr.id)
        .eq("status", "AVAILABLE")
        .is("memory_id", null)
        .select("id,code,status,memory_id,assigned_at,activated_at")
        .maybeSingle();

      if (activateError || !activeQr) {
        console.error(activateError);

        await supabaseAdmin
          .from("memories")
          .delete()
          .eq("id", memory.id)
          .eq("created_by", qr.created_by);

        await removeAudio(path);

        return NextResponse.json(
          { error: "This QR code was activated by another submission." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { memory, qrCode: activeQr },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: "Action must be prepare or complete." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Pre-made QR memory error:", error);

    return NextResponse.json(
      { error: "Unexpected error while saving your Memory Block." },
      { status: 500 }
    );
  }
}
