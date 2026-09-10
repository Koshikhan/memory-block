import { createClient } from "@/lib/supabase/client";

export type MemoryCreationMode = "STAFF" | "CUSTOMER";

type BaseMemoryInput = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sender: string;
  recipient: string;
  message: string;
};

type CreateMemoryInput = BaseMemoryInput & {
  audioFile: File;
};

type CreatePendingMemoryInput = BaseMemoryInput;

const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
};

function validateDetails(input: BaseMemoryInput) {
  const orderNumber = input.orderNumber.trim();
  const customerName = input.customerName.trim();
  const customerEmail = input.customerEmail.trim();
  const customerPhone = input.customerPhone.trim();
  const sender = input.sender.trim();
  const recipient = input.recipient.trim();
  const message = input.message.trim();

  if (!orderNumber) {
    throw new Error("Enter the order number.");
  }

  if (!customerName) {
    throw new Error("Enter the customer’s name.");
  }

  if (!sender || !recipient) {
    throw new Error(
      "Enter the sender’s and recipient’s names."
    );
  }

  if (orderNumber.length > 80) {
    throw new Error(
      "Order number must be 80 characters or fewer."
    );
  }

  if (
    customerName.length > 80 ||
    sender.length > 80 ||
    recipient.length > 80
  ) {
    throw new Error(
      "Names must be 80 characters or fewer."
    );
  }

  if (customerEmail.length > 254) {
    throw new Error("Email address is too long.");
  }

  if (customerPhone.length > 30) {
    throw new Error("Mobile number is too long.");
  }

  if (message.length > 500) {
    throw new Error(
      "Your message must be 500 characters or fewer."
    );
  }

  return {
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    sender,
    recipient,
    message,
  };
}

async function getStaffUser() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffError) {
    throw new Error(staffError.message);
  }

  if (!staff) {
    throw new Error(
      "Your account does not have staff upload access."
    );
  }

  return {
    supabase,
    user,
  };
}

/**
 * Staff uploads or records the audio immediately.
 */
export async function createMemory(
  input: CreateMemoryInput
) {
  const details = validateDetails(input);
  const file = input.audioFile;

  if (
    file.size === 0 ||
    file.size > 25 * 1024 * 1024
  ) {
    throw new Error(
      "Choose a non-empty audio file up to 25 MB."
    );
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase() ?? "";

  const contentType = AUDIO_TYPES[extension];

  if (!contentType) {
    throw new Error(
      "Choose an MP3, M4A, WAV, OGG, OPUS or WebM file."
    );
  }

  const { supabase, user } = await getStaffUser();

  const id = crypto.randomUUID();
  const publicCode = crypto.randomUUID();

  const audioPath =
    `${user.id}/${id}.${extension}`;

  const { error: uploadError } =
    await supabase.storage
      .from("voice-notes")
      .upload(audioPath, file, {
        contentType,
        upsert: false,
      });

  if (uploadError) {
    throw new Error(
      `Audio upload failed: ${uploadError.message}`
    );
  }

  const { error: saveError } = await supabase
    .from("memories")
    .insert({
      id,
      public_code: publicCode,
      created_by: user.id,

      order_number: details.orderNumber,
      customer_name: details.customerName,
      customer_email:
        details.customerEmail || null,
      customer_phone:
        details.customerPhone || null,

      sender_name: details.sender,
      recipient_name: details.recipient,
      message: details.message,

      audio_path: audioPath,

      status: "READY",
      uploaded_at: new Date().toISOString(),

      upload_token: null,
      upload_expires_at: null,
    });

  if (saveError) {
    throw new Error(
      `The recording uploaded, but saving its details could not be confirmed. ` +
        `Reference: ${id}. ${saveError.message}`
    );
  }

  return {
    id,
    publicCode,
    audioPath,
    status: "READY" as const,
  };
}

/**
 * Creates an order before the customer has uploaded audio.
 */
export async function createPendingMemory(
  input: CreatePendingMemoryInput
) {
  const details = validateDetails(input);

  if (
    !details.customerEmail &&
    !details.customerPhone
  ) {
    throw new Error(
      "Enter the customer’s email address or mobile number."
    );
  }

  const { supabase, user } = await getStaffUser();

  const id = crypto.randomUUID();
  const publicCode = crypto.randomUUID();
  const uploadToken = crypto.randomUUID();

  const expiresAt = new Date();

  // Customer has 14 days to submit the recording.
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { error: saveError } = await supabase
    .from("memories")
    .insert({
      id,
      public_code: publicCode,
      upload_token: uploadToken,

      created_by: user.id,

      order_number: details.orderNumber,
      customer_name: details.customerName,
      customer_email:
        details.customerEmail || null,
      customer_phone:
        details.customerPhone || null,

      sender_name: details.sender,
      recipient_name: details.recipient,
      message: details.message,

      status: "WAITING_FOR_UPLOAD",

      audio_path: null,
      uploaded_at: null,

      upload_expires_at:
        expiresAt.toISOString(),
    });

  if (saveError) {
    throw new Error(
      `Unable to create this order: ${saveError.message}`
    );
  }

  return {
    id,
    publicCode,
    uploadToken,
    uploadExpiresAt: expiresAt.toISOString(),
    status: "WAITING_FOR_UPLOAD" as const,
  };
}