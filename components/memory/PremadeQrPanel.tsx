import Link from "next/link";

export default function PremadeQrPanel() {
  return (
    <section className="mt-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-lg">
              ▣
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">
                Pre-made QR blocks
              </p>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                Manage QR codes already attached to Memory Blocks
              </h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            Generate and print QR labels in advance. Customers can scan the QR
            already attached to their block, record their voice message, and
            activate that exact QR automatically.
          </p>
        </div>

        <Link
          href="/qr-inventory"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 font-semibold text-white transition hover:bg-emerald-900"
        >
          Open QR Inventory
        </Link>
      </div>
    </section>
  );
}
