"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { QR_BATCH_SIZES } from "@/lib/constants";
import StaffHeader from "@/components/layout/StaffHeader";
import type {
  QrBatch,
  QrCodeRecord,
  QrStatus,
} from "@/types/qr";

type QrCode = Pick<
  QrCodeRecord,
  | "id"
  | "batch_id"
  | "code"
  | "status"
  | "memory_id"
  | "created_at"
  | "assigned_at"
  | "activated_at"
  | "voided_at"
>;

type QrBatchSize = (typeof QR_BATCH_SIZES)[number];

function statusPill(status: QrStatus) {
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

export default function QrInventoryPage() {
  const router = useRouter();

  const [batches, setBatches] = useState<QrBatch[]>([]);
  const [codes, setCodes] = useState<QrCode[]>([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<QrBatchSize | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadInventory = useCallback(async () => {
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
        .eq("created_by", user.id)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("qr_codes")
        .select(`
          id,
          batch_id,
          code,
          status,
          memory_id,
          created_at,
          assigned_at,
          activated_at,
          voided_at
        `)
        .eq("created_by", user.id)
        .order("created_at", {
          ascending: false,
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

    setBatches(batchData ?? []);
    setCodes((codeData ?? []) as QrCode[]);
    setError("");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  async function generateBatch(quantity: QrBatchSize) {
    if (generating) return;

    setGenerating(quantity);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/qr-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          quantity,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to generate QR batch."
        );
      }

      setSuccess(
        `Batch #${result.batch.batch_number} created with ${result.codes.length} QR codes.`
      );

      await loadInventory();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to generate QR batch."
      );
    } finally {
      setGenerating(null);
    }
  }

  const counts = useMemo(() => {
    return {
      total: codes.length,
      available: codes.filter(
        (code) => code.status === "AVAILABLE"
      ).length,
      assigned: codes.filter(
        (code) => code.status === "ASSIGNED"
      ).length,
      active: codes.filter(
        (code) => code.status === "ACTIVE"
      ).length,
      void: codes.filter(
        (code) => code.status === "VOID"
      ).length,
    };
  }, [codes]);

  function countsForBatch(batchId: string) {
    const batchCodes = codes.filter(
      (code) => code.batch_id === batchId
    );

    return {
      total: batchCodes.length,
      available: batchCodes.filter(
        (code) => code.status === "AVAILABLE"
      ).length,
      assigned: batchCodes.filter(
        (code) => code.status === "ASSIGNED"
      ).length,
      active: batchCodes.filter(
        (code) => code.status === "ACTIVE"
      ).length,
      void: batchCodes.filter(
        (code) => code.status === "VOID"
      ).length,
    };
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <StaffHeader
        current="qr-inventory"
        maxWidth="7xl"
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
              Pre-printed labels
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              QR Inventory
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">
              Generate QR labels in advance, print them as stock,
              and assign them to Memory Block orders later.
            </p>
          </div>

          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-lg border border-emerald-900 px-5 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            View orders
          </Link>
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Generate QR batch
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose how many pre-made QR labels you want to create.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {QR_BATCH_SIZES.map((quantity) => (
                <button
                  key={quantity}
                  type="button"
                  onClick={() =>
                    void generateBatch(quantity)
                  }
                  disabled={generating !== null}
                  className="rounded-lg bg-emerald-950 px-5 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating === quantity
                    ? "Creating…"
                    : quantity}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            {success}
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Total QR codes
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
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                QR batches
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your newest batches appear first.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              Loading QR inventory…
            </div>
          ) : batches.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <p className="font-semibold text-slate-700">
                No QR batches yet
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Generate your first batch using the buttons above.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Batch</th>
                      <th className="px-5 py-4">Created</th>
                      <th className="px-5 py-4">Total</th>
                      <th className="px-5 py-4">Available</th>
                      <th className="px-5 py-4">Assigned</th>
                      <th className="px-5 py-4">Active</th>
                      <th className="px-5 py-4">Void</th>
                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {batches.map((batch) => {
                      const batchCounts =
                        countsForBatch(batch.id);

                      return (
                        <tr
                          key={batch.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold">
                              Batch #{batch.batch_number}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Requested{" "}
                              {batch.requested_quantity}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {new Intl.DateTimeFormat(
                              "en-GB",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }
                            ).format(
                              new Date(batch.created_at)
                            )}
                          </td>

                          <td className="px-5 py-4 font-semibold">
                            {batchCounts.total}
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill("AVAILABLE")}`}>
                              {batchCounts.available}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill("ASSIGNED")}`}>
                              {batchCounts.assigned}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill("ACTIVE")}`}>
                              {batchCounts.active}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill("VOID")}`}>
                              {batchCounts.void}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/qr-inventory/${batch.id}`}
                              className="inline-flex rounded-lg border border-emerald-900 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                            >
                              Open batch
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
