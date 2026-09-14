export type MemoryStatus =
  | "WAITING_FOR_UPLOAD"
  | "READY"
  | "CANCELLED"
  | "ARCHIVED";

export type MemorySource =
  | "STAFF"
  | "PRIVATE_LINK"
  | "SHOP_QR"
  | "PREMADE_QR";

export type CreationMode =
  | "STAFF"
  | "CUSTOMER";

export type MemoryOrder = {
  id: string;
  order_number: string | null;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  sender_name: string;
  recipient_name: string;
  message: string | null;

  status: MemoryStatus;

  audio_path: string | null;

  upload_token: string | null;
  upload_expires_at: string | null;

  public_code: string;

  created_at: string;
  uploaded_at: string | null;

  upload_source: MemorySource | null;
  label_printed_at: string | null;
};
