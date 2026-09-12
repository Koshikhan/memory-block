"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/client";

type QrBatch = {
  id: string;
  batch_number: number;
  requested_quantity: number;
  created_at: string;
};

type QrCode = {
  id: string;
  code: string;
  status: "AVAILABLE" | "ASSIGNED" | "ACTIVE" | "VOID";
  memory_id: string | null;
  created_at: string;
};

type RenderedQr = QrCode & {
  qrUrl: string;
  publicUrl: string;
};

function statusStyles(status: QrCode["status"]) {
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function QrBatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [batch, setBatch] = useState<QrBatch | null>(null);
  const [codes, setCodes] = useState<QrCode[]>([]);
  const [renderedCodes, setRenderedCodes] = useState<RenderedQr[]>([]);

  const [loading, setLoading] = useState(true);
  const [generatingQrs, setGeneratingQrs] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBatch() {
      setLoading(true);
      setError("");

      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const [
        { data: batchData, error: batchError },
        { data: codeData, error: codeError },
      ] = await Promise.all([
        supabase
          .from("qr_batches")
          .select(`
            id,
            batch_number,
            requested_quantity,
            created_at
          `)
          .eq("id", params.id)
          .eq("created_by", user.id)
          .maybeSingle(),

        supabase
          .from("qr_codes")
          .select(`
            id,
            code,
            status,
            memory_id,
            created_at
          `)
          .eq("batch_id", params.id)
          .eq("created_by", user.id)
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (batchError) {
        setError(batchError.message);
        setLoading(false);
        return;
      }

      if (codeError) {
        setError(codeError.message);
        setLoading(false);
        return;
      }

      if (!batchData) {
        setError("QR batch could not be found.");
        setLoading(false);
        return;
      }

      setBatch(batchData);
      setCodes((codeData ?? []) as QrCode[]);
      setLoading(false);
    }

    void loadBatch();
  }, [params.id, router]);

  useEffect(() => {
    async function generateQrs() {
      if (codes.length === 0) {
        setRenderedCodes([]);
        return;
      }

      setGeneratingQrs(true);

      try {
        // IMPORTANT:
        // Pre-printed QR codes must always point to the live production app.
        // Do not use localhost or a LAN IP here, otherwise printed QR codes
        // would stop working outside your development network.
        const baseUrl =
          "https://memoryblockapp.vercel.app";

        const rendered = await Promise.all(
          codes.map(async (item) => {
            const publicUrl = `${baseUrl}/q/${item.code}`;

            const qrUrl = await QRCode.toDataURL(publicUrl, {
              width: 500,
              margin: 1,
              errorCorrectionLevel: "H",
            });

            return {
              ...item,
              qrUrl,
              publicUrl,
            };
          })
        );

        setRenderedCodes(rendered);
      } catch (caught) {
        console.error("Batch QR generation failed:", caught);
        setError("Unable to generate QR previews for this batch.");
      } finally {
        setGeneratingQrs(false);
      }
    }

    void generateQrs();
  }, [codes]);

  const counts = useMemo(() => {
    return {
      total: codes.length,
      available: codes.filter(
        (item) => item.status === "AVAILABLE"
      ).length,
      assigned: codes.filter(
        (item) => item.status === "ASSIGNED"
      ).length,
      active: codes.filter(
        (item) => item.status === "ACTIVE"
      ).length,
      void: codes.filter(
        (item) => item.status === "VOID"
      ).length,
    };
  }, [codes]);

  function printBatch() {
    if (!batch || renderedCodes.length === 0) return;

    const printWindow = window.open(
      "",
      "_blank",
      "width=1100,height=900"
    );

    if (!printWindow) {
      alert(
        "The print window was blocked. Please allow pop-ups and try again."
      );
      return;
    }

    const cards = renderedCodes
      .map((item, index) => {
        const safeCode = escapeHtml(item.code);

        return `
          <div class="label">
            <div class="brand">MEMORY BLOCK</div>

            <img
              class="qr"
              src="${item.qrUrl}"
              alt="QR ${safeCode}"
            />

            <div class="scan">SCAN TO OPEN MEMORY</div>

            <div class="code">${safeCode}</div>

            <div class="number">
              ${String(index + 1).padStart(2, "0")}
              /
              ${String(renderedCodes.length).padStart(2, "0")}
            </div>
          </div>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />

          <title>
            Memory Block - Batch #${batch.batch_number}
          </title>

          <style>
            @page {
              size: A4;
              margin: 10mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: white;
              color: #064e3b;

              font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Arial,
                sans-serif;
            }

            .sheet {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 6mm;
            }

            .label {
              min-height: 82mm;

              border: 0.4mm solid #064e3b;
              border-radius: 3mm;

              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;

              padding: 5mm;

              text-align: center;

              break-inside: avoid;
              page-break-inside: avoid;
            }

            .brand {
              font-size: 9pt;
              font-weight: 800;
              letter-spacing: 2px;
            }

            .qr {
              width: 45mm;
              height: 45mm;
              margin: 3mm 0 2mm;
              display: block;
            }

            .scan {
              font-size: 6.5pt;
              font-weight: 700;
              color: #475569;
            }

            .code {
              margin-top: 1.5mm;

              font-size: 8pt;
              font-weight: 800;
              letter-spacing: 1.2px;

              color: #064e3b;
            }

            .number {
              margin-top: 1mm;

              font-size: 6pt;
              color: #94a3b8;
            }

            @media print {
              .sheet {
                grid-template-columns: repeat(3, 1fr);
              }
            }
          </style>
        </head>

        <body>
          <div class="sheet">
            ${cards}
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.print();
              }, 350);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-center text-slate-500">
        Loading QR batch…
      </main>
    );
  }

  if (error || !batch) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "QR batch not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-xl font-bold tracking-widest text-emerald-900"
          >
            MEMORY BLOCK
          </Link>

          <Link
            href="/qr-inventory"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← QR Inventory
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
              Pre-printed QR labels
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Batch #{batch.batch_number}
            </h1>

            <p className="mt-2 text-slate-600">
              Created{" "}
              {new Intl.DateTimeFormat(
                "en-GB",
                {
                  dateStyle: "medium",
                  timeStyle: "short",
                }
              ).format(new Date(batch.created_at))}
            </p>
          </div>

          <button
            type="button"
            onClick={printBatch}
            disabled={
              renderedCodes.length === 0 ||
              generatingQrs
            }
            className="inline-flex items-center justify-center rounded-lg bg-emerald-950 px-5 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generatingQrs
              ? "Preparing QR codes…"
              : `Print batch (${renderedCodes.length})`}
          </button>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Total
            </p>

            <p className="mt-2 text-3xl font-bold">
              {counts.total}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm text-emerald-700">
              Available
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {counts.available}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm text-amber-700">
              Assigned
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-900">
              {counts.assigned}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm text-blue-700">
              Active
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-900">
              {counts.active}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-100 p-5">
            <p className="text-sm text-slate-600">
              Void
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-800">
              {counts.void}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              QR codes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These codes can be printed now and assigned to orders later.
            </p>
          </div>

          {generatingQrs ? (
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
      </div>
    </main>
  );
}
