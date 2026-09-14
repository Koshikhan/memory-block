import MemoryQr from "@/components/MemoryQr";
import type { CreationMode } from "@/types/memory";

type SavedMemorySummary = {
  status: string;
  publicCode: string;
};

type Props = {
  savedMemory: SavedMemorySummary | null;
  customerUploadReady: boolean;
  orderNumber: string;
  recipient: string;
  customerUploadUrl: string;
  copied: boolean;
  saving: boolean;
  recordingBusy: boolean;
  creationMode: CreationMode;
  audioFile: File | null;
  onCopyUploadLink: () => void;
  onOpenWhatsApp: () => void;
  onStartNewMemory: () => void;
};

export default function MemoryCreationResult({
  savedMemory,
  customerUploadReady,
  orderNumber,
  recipient,
  customerUploadUrl,
  copied,
  saving,
  recordingBusy,
  creationMode,
  audioFile,
  onCopyUploadLink,
  onOpenWhatsApp,
  onStartNewMemory,
}: Props) {
  if (!savedMemory) {
    return (
      <button
        type="submit"
        disabled={
          saving ||
          recordingBusy ||
          (creationMode === "STAFF" && !audioFile)
        }
        className="mt-7 w-full rounded-lg bg-emerald-900 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "Creating…"
          : creationMode === "CUSTOMER"
            ? "Create order & upload link"
            : "Save memory"}
      </button>
    );
  }

  const ready =
    savedMemory.status === "READY" ||
    customerUploadReady;

  return (
    <div className="mt-7">
      {ready ? (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <p className="font-semibold">
              {customerUploadReady
                ? "✓ Customer voice message received"
                : "✓ Memory saved successfully"}
            </p>

            <p className="mt-2 text-sm">
              {customerUploadReady
                ? "The customer recording has arrived and the QR code is now available."
                : "The voice message is ready and the QR code can now be printed."}
            </p>
          </div>

          <MemoryQr
            publicCode={savedMemory.publicCode}
            recipientName={recipient}
          />
        </>
      ) : (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-amber-500" />

              <div>
                <p className="font-semibold text-amber-950">
                  Waiting for customer upload
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Order <strong>{orderNumber}</strong> has been created.
                  Send the private link below to the customer.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-900">
              Private customer upload link
            </p>

            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="break-all text-xs leading-5 text-slate-600">
                {customerUploadUrl}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCopyUploadLink}
                className="rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
              >
                {copied ? "Copied ✓" : "Copy link"}
              </button>

              <button
                type="button"
                onClick={onOpenWhatsApp}
                className="rounded-lg bg-emerald-900 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
              >
                Open WhatsApp
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              ⏳
            </div>

            <p className="mt-3 font-semibold text-slate-700">
              QR code pending
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              The QR code will become available once the customer submits
              their voice message.
            </p>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onStartNewMemory}
        className="mt-5 w-full rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
      >
        Create another memory
      </button>
    </div>
  );
}
