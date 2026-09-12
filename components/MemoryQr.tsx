"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  publicCode: string;
  recipientName: string;
  printed?: boolean;
  markingPrinted?: boolean;
  onPrinted?: () => void | Promise<void>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function MemoryQr({
  publicCode,
  recipientName,
  printed = false,
  markingPrinted = false,
  onPrinted,
}: Props) {
  const [qrUrl, setQrUrl] = useState("");
  const [memoryUrl, setMemoryUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function generateQr() {
      const configuredBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

      const baseUrl =
        configuredBaseUrl || window.location.origin;

      const url = `${baseUrl}/memory/${publicCode}`;

      setMemoryUrl(url);

      try {
        const generatedQr = await QRCode.toDataURL(url, {
          width: 600,
          margin: 2,
          errorCorrectionLevel: "H",
        });

        setQrUrl(generatedQr);
      } catch (error) {
        console.error("QR generation failed:", error);
      }
    }

    generateQr();
  }, [publicCode]);

  async function copyLink() {
    if (!memoryUrl) return;

    try {
      await navigator.clipboard.writeText(memoryUrl);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      alert("Unable to copy the link.");
    }
  }

  function downloadQr() {
    if (!qrUrl) return;

    const link = document.createElement("a");

    link.href = qrUrl;
    link.download = `memory-block-${publicCode}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printLabel() {
    if (!qrUrl || !memoryUrl || markingPrinted) return;

    const printWindow = window.open(
      "",
      "_blank",
      "width=700,height=700"
    );

    if (!printWindow) {
      alert(
        "The print window was blocked. Please allow pop-ups and try again."
      );
      return;
    }

    const safeRecipient =
      escapeHtml(recipientName.trim() || "Someone special");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />

          <title>Memory Block - ${safeRecipient}</title>

          <style>
            @page {
              size: 70mm 70mm;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              width: 70mm;
              height: 70mm;
            }

            body {
              font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Arial,
                sans-serif;

              background: white;
              color: #064e3b;
            }

            .label {
              width: 70mm;
              height: 70mm;

              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;

              padding: 5mm;

              text-align: center;

              border: 0.4mm solid #064e3b;
            }

            .brand {
              margin: 0;

              font-size: 10pt;
              font-weight: 800;

              letter-spacing: 2.5px;
            }

            .qr {
              width: 37mm;
              height: 37mm;

              margin-top: 2.5mm;
              margin-bottom: 2mm;

              display: block;
            }

            .small {
              margin: 0;

              font-size: 6.5pt;
              color: #64748b;
            }

            .recipient {
              max-width: 56mm;

              margin: 1mm 0 0;

              overflow: hidden;

              font-size: 11pt;
              font-weight: 700;

              line-height: 1.15;

              color: #064e3b;
            }

            .scan {
              margin: 2mm 0 0;

              font-size: 6.5pt;
              font-weight: 600;

              color: #475569;
            }

            @media print {
              html,
              body {
                width: 70mm;
                height: 70mm;
              }

              .label {
                break-inside: avoid;
              }
            }
          </style>
        </head>

        <body>
          <div class="label">
            <p class="brand">
              MEMORY BLOCK
            </p>

            <img
              class="qr"
              src="${qrUrl}"
              alt="Memory QR code"
            />

            <p class="small">
              A memory for
            </p>

            <p class="recipient">
              ${safeRecipient}
            </p>

            <p class="scan">
              Scan to hear your voice memory
            </p>
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Safari does not reliably fire `afterprint` for popup windows.
    // As soon as the print window has successfully opened, mark the
    // order as printed. This keeps the staff dashboard in sync.
    if (!printed && onPrinted) {
      void onPrinted();
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-center">
        <p className="font-semibold text-slate-900">
          Memory QR Code
        </p>

        <p className="mt-2 text-sm text-slate-500">
          Place this QR code on the physical Memory Block.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-xs">
        <div className="aspect-square rounded-2xl border-2 border-emerald-950 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-extrabold tracking-[0.25em] text-emerald-950">
            MEMORY BLOCK
          </p>

          {qrUrl ? (
            <img
              src={qrUrl}
              alt="Memory QR code"
              className="mx-auto mt-3 w-[65%]"
            />
          ) : (
            <div className="mx-auto mt-3 flex aspect-square w-[65%] items-center justify-center bg-slate-50">
              <p className="text-xs text-slate-400">
                Generating…
              </p>
            </div>
          )}

          <p className="mt-2 text-xs text-slate-400">
            A memory for
          </p>

          <p className="mt-1 truncate font-semibold text-emerald-950">
            {recipientName.trim() || "Someone special"}
          </p>

          <p className="mt-2 text-[10px] font-medium text-slate-500">
            Scan to hear your voice memory
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-500">
          Recipient link
        </p>

        <p className="break-all text-xs text-slate-500">
          {memoryUrl}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={!memoryUrl}
          className="rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-50"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>

        <button
          type="button"
          onClick={downloadQr}
          disabled={!qrUrl}
          className="rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-50"
        >
          Download QR
        </button>
      </div>

      <button
        type="button"
        onClick={printLabel}
        disabled={!qrUrl || markingPrinted}
        className="mt-3 w-full rounded-lg bg-emerald-900 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
      >
        {markingPrinted
          ? "Marking as printed…"
          : printed
            ? "Print label again"
            : "Print Memory Block label"}
      </button>

      {printed && (
        <p className="mt-3 text-center text-xs font-medium text-emerald-700">
          ✓ This order is marked as printed.
        </p>
      )}

      <p className="mt-2 text-center text-xs text-slate-400">
        Print size: 70 × 70 mm
      </p>
    </div>
  );
}
