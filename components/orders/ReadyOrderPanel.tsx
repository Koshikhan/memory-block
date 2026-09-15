import MemoryQr from "@/components/MemoryQr";
import PremadeQrAssignmentCard, {
  type AssignedQr,
} from "@/components/orders/PremadeQrAssignmentCard";
import type { MemoryOrder } from "@/types/memory";

type ReadyOrder = Pick<
  MemoryOrder,
  | "uploaded_at"
  | "upload_source"
  | "label_printed_at"
  | "public_code"
  | "recipient_name"
>;

type Props = {
  order: ReadyOrder;
  memoryUrl: string;
  assignedQr: AssignedQr | null;
  qrCodeInput: string;
  qrBusy: boolean;
  qrError: string;
  qrSuccess: string;
  premadeQrUrl: string;
  markingPrinted: boolean;
  onCodeChange: (value: string) => void;
  onAssign: () => void;
  onActivate: (code: string) => void;
  onPrinted: () => void;
};

export default function ReadyOrderPanel({
  order,
  memoryUrl,
  assignedQr,
  qrCodeInput,
  qrBusy,
  qrError,
  qrSuccess,
  premadeQrUrl,
  markingPrinted,
  onCodeChange,
  onAssign,
  onActivate,
  onPrinted,
}: Props) {
  return (
    <>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-900">
          ✓ Voice message received
        </p>

        {order.uploaded_at && (
          <p className="mt-2 text-sm text-emerald-700">
            Received{" "}
            {new Intl.DateTimeFormat(
              "en-GB",
              {
                dateStyle: "medium",
                timeStyle: "short",
              }
            ).format(
              new Date(order.uploaded_at)
            )}
          </p>
        )}
      </div>

      <a
        href={memoryUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 block rounded-lg border border-emerald-900 px-4 py-3 text-center font-semibold text-emerald-900 hover:bg-emerald-50"
      >
        Open recipient page
      </a>

      <PremadeQrAssignmentCard
        assignedQr={assignedQr}
        qrCodeInput={qrCodeInput}
        qrBusy={qrBusy}
        qrError={qrError}
        qrSuccess={qrSuccess}
        premadeQrUrl={premadeQrUrl}
        onCodeChange={onCodeChange}
        onAssign={onAssign}
        onActivate={onActivate}
      />

      {order.upload_source !== "PREMADE_QR" && (
        <>
          {order.label_printed_at && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
              <p className="font-semibold text-emerald-900">
                ✓ Label printed
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {new Intl.DateTimeFormat(
                  "en-GB",
                  {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }
                ).format(
                  new Date(
                    order.label_printed_at
                  )
                )}
              </p>
            </div>
          )}

          <MemoryQr
            publicCode={order.public_code}
            recipientName={
              order.recipient_name
            }
            printed={
              !!order.label_printed_at
            }
            markingPrinted={
              markingPrinted
            }
            onPrinted={onPrinted}
          />
        </>
      )}

      {order.upload_source === "PREMADE_QR" && (
        <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="font-semibold text-cyan-900">
            ✓ No new QR label needs to be printed
          </p>

          <p className="mt-1 text-sm leading-6 text-cyan-800">
            This order was created from the pre-printed QR already attached to
            the physical Memory Block.
          </p>
        </div>
      )}
    </>
  );
}
