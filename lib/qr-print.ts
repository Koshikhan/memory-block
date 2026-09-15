type PrintableQr = {
    code: string;
    qrUrl: string;
  };
  
  type PrintQrBatchOptions = {
    batchNumber: number;
    renderedCodes: PrintableQr[];
  };
  
  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  export function printQrBatch({
    batchNumber,
    renderedCodes,
  }: PrintQrBatchOptions) {
    if (renderedCodes.length === 0) {
      return;
    }
  
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
            Memory Block - Batch #${batchNumber}
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
  