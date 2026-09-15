import Link from "next/link";

import type {
  QrCodeRecord,
  QrStatus,
} from "@/types/qr";

export type AssignedQr = Pick<
  QrCodeRecord,
  | "id"
  | "code"
  | "assigned_at"
  | "activated_at"
> & {
  status: Extract<
    QrStatus,
    "ASSIGNED" | "ACTIVE"
  >;
  memory_id: string;
};

type Props = {
  assignedQr: AssignedQr | null;
  qrCodeInput: string;
  qrBusy: boolean;
  qrError: string;
  qrSuccess: string;
  premadeQrUrl: string;
  onCodeChange: (value: string) => void;
  onAssign: () => void;
  onActivate: (code: string) => void;
};

export default function PremadeQrAssignmentCard({
  assignedQr,
  qrCodeInput,
  qrBusy,
  qrError,
  qrSuccess,
  premadeQrUrl,
  onCodeChange,
  onAssign,
  onActivate,
}: Props) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">
            Pre-printed QR label
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Optional. Use one of the QR labels you printed in advance instead
            of printing a new QR for this order.
          </p>
        </div>

        <Link
          href="/qr-inventory"
          className="shrink-0 text-sm font-semibold text-emerald-800 hover:underline"
        >
          QR inventory
        </Link>
      </div>

      {!assignedQr ? (
        <>
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            QR code
          </label>

          <input
            type="text"
            value={qrCodeInput}
            onChange={(event) =>
              onCodeChange(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
              )
            }
            placeholder="Example: GBGX3NTCRV"
            maxLength={20}
            disabled={qrBusy}
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-mono uppercase tracking-wider outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />

          <p className="mt-2 text-xs text-slate-400">
            Enter the code printed underneath the physical pre-made QR label.
          </p>

          <button
            type="button"
            onClick={onAssign}
            disabled={
              qrBusy ||
              !qrCodeInput.trim()
            }
            className="mt-4 w-full rounded-lg bg-emerald-950 px-4 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {qrBusy
              ? "Assigning…"
              : "Assign pre-printed QR"}
          </button>
        </>
      ) : (
        <div
          className={`mt-5 rounded-xl border p-4 ${
            assignedQr.status === "ACTIVE"
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assigned QR
              </p>

              <p className="mt-1 font-mono text-lg font-bold tracking-widest text-slate-900">
                {assignedQr.code}
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                assignedQr.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {assignedQr.status === "ACTIVE"
                ? "Active"
                : "Assigned"}
            </span>
          </div>

          {assignedQr.status === "ASSIGNED" && (
            <>
              <p className="mt-4 text-sm leading-6 text-amber-800">
                The physical QR is linked to this order, but it will not open
                the voice memory until you activate it.
              </p>

              <button
                type="button"
                onClick={() =>
                  onActivate(assignedQr.code)
                }
                disabled={qrBusy}
                className="mt-4 w-full rounded-lg bg-emerald-950 px-4 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {qrBusy
                  ? "Activating…"
                  : "Activate QR"}
              </button>
            </>
          )}

          {assignedQr.status === "ACTIVE" && (
            <>
              <p className="mt-4 text-sm leading-6 text-emerald-800">
                ✓ This pre-printed QR is active. Scanning the physical label
                now opens this voice memory.
              </p>

              <a
                href={premadeQrUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-lg border border-emerald-900 px-4 py-3 text-center font-semibold text-emerald-900 hover:bg-emerald-50"
              >
                Test pre-printed QR page
              </a>
            </>
          )}
        </div>
      )}

      {qrError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {qrError}
        </div>
      )}

      {qrSuccess && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {qrSuccess}
        </div>
      )}
    </div>
  );
}
