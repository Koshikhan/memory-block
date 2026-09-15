"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/client";
import StaffDetailHeader from "@/components/layout/StaffDetailHeader";
import { PRODUCTION_APP_URL } from "@/lib/constants";
import type {
  QrBatch,
  QrCodeRecord,
} from "@/types/qr";
import { printQrBatch } from "@/lib/qr-print";
import QrBatchPreviewGrid, {
  type RenderedQr,
} from "@/components/qr/QrBatchPreviewGrid";

type QrCode = Pick<
  QrCodeRecord,
  | "id"
  | "code"
  | "status"
  | "memory_id"
  | "created_at"
>;


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
          PRODUCTION_APP_URL;

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

    printQrBatch({
      batchNumber: batch.batch_number,
      renderedCodes,
    });
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
      <StaffDetailHeader
        backHref="/qr-inventory"
        backLabel="QR Inventory"
        maxWidth="7xl"
      />

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

        <QrBatchPreviewGrid
          renderedCodes={renderedCodes}
          generating={generatingQrs}
        />
      </div>
    </main>
  );
}
