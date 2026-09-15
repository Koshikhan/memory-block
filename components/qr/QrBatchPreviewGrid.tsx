import type {
    QrCodeRecord,
    QrStatus,
  } from "@/types/qr";
  
  type QrCode = Pick<
    QrCodeRecord,
    | "id"
    | "code"
    | "status"
    | "memory_id"
    | "created_at"
  >;
  
  export type RenderedQr = QrCode & {
    qrUrl: string;
    publicUrl: string;
  };
  
  type Props = {
    renderedCodes: RenderedQr[];
    generating: boolean;
  };
  
  function statusStyles(status: QrStatus) {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-100 text-emerald-800";
      case "ASSIGNED":
        return "bg-amber-100 text-amber-800";
      case "ACTIVE":
        return "bg-blue-100 text-blue-800";
      case "VOID":
        return "bg-slate-200 text-slate-700";
    }
  }
  
  export default function QrBatchPreviewGrid({
    renderedCodes,
    generating,
  }: Props) {
    return (
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">
            QR codes
          </h2>
  
          <p className="mt-1 text-sm text-slate-500">
            These codes can be printed now and assigned to orders later.
          </p>
        </div>
  
        {generating ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Generating QR previews…
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {renderedCodes.map((item, index) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      QR {index + 1}
                    </p>
  
                    <p className="mt-1 font-mono text-sm font-bold tracking-wider text-slate-900">
                      {item.code}
                    </p>
                  </div>
  
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>
  
                <img
                  src={item.qrUrl}
                  alt={`QR ${item.code}`}
                  className="mx-auto mt-5 w-full max-w-[220px]"
                />
  
                <p className="mt-4 break-all text-center text-[11px] text-slate-400">
                  {item.publicUrl}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }
  