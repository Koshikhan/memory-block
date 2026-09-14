export type QrStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "ACTIVE"
  | "VOID";

export type QrCodeRecord = {
  id: string;
  code: string;
  batch_id: string;
  created_by: string;

  status: QrStatus;

  memory_id: string | null;

  created_at: string;
  assigned_at: string | null;
  activated_at: string | null;
  voided_at: string | null;
};

export type QrBatch = {
  id: string;
  batch_number: number;
  requested_quantity: number;
  created_at: string;
};
