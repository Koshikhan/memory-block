"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { PRODUCTION_APP_URL } from "@/lib/constants";
import MemoryQr from "@/components/MemoryQr";
import OrderDetailsCard from "@/components/orders/OrderDetailsCard";
import type { MemoryOrder as MemoryOrderRecord } from "@/types/memory";
import type { QrCodeRecord, QrStatus } from "@/types/qr";

type MemoryOrder = Pick<
  MemoryOrderRecord,
  | "id"
  | "order_number"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "sender_name"
  | "recipient_name"
  | "message"
  | "status"
  | "audio_path"
  | "upload_token"
  | "upload_expires_at"
  | "public_code"
  | "created_at"
  | "uploaded_at"
  | "upload_source"
  | "label_printed_at"
>;

type AssignedQr = Pick<
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

export default function OrderPage() {
  const params = useParams<{
    id: string;
  }>();

  const router = useRouter();

  const [order, setOrder] =
    useState<MemoryOrder | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  const [markingPrinted, setMarkingPrinted] =
    useState(false);

  const [assignedQr, setAssignedQr] =
    useState<AssignedQr | null>(null);

  const [qrCodeInput, setQrCodeInput] =
    useState("");

  const [qrBusy, setQrBusy] =
    useState(false);

  const [qrError, setQrError] =
    useState("");

  const [qrSuccess, setQrSuccess] =
    useState("");

  useEffect(() => {
    async function loadOrder() {
      const supabase =
        createClient();

      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const [
        {
          data,
          error,
        },
        {
          data: assignedQrData,
          error: assignedQrError,
        },
      ] = await Promise.all([
        supabase
          .from("memories")
          .select(`
            id,
            order_number,
            customer_name,
            customer_email,
            customer_phone,
            sender_name,
            recipient_name,
            message,
            status,
            audio_path,
            upload_token,
            upload_expires_at,
            public_code,
            created_at,
            uploaded_at,
            upload_source,
            label_printed_at
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
            assigned_at,
            activated_at
          `)
          .eq("created_by", user.id)
          .eq("memory_id", params.id)
          .in("status", [
            "ASSIGNED",
            "ACTIVE",
          ])
          .maybeSingle(),
      ]);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (assignedQrError) {
        setError(assignedQrError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError(
          "Order could not be found."
        );

        setLoading(false);
        return;
      }

      setOrder(data);

      if (assignedQrData) {
        setAssignedQr(
          assignedQrData as AssignedQr
        );

        setQrCodeInput(
          assignedQrData.code
        );
      }

      setLoading(false);
    }

    loadOrder();
  }, [params.id, router]);

  function getBaseUrl() {
    return (
      process.env
        .NEXT_PUBLIC_APP_URL?.replace(
          /\/$/,
          ""
        ) ||
      window.location.origin
    );
  }

  function getUploadUrl() {
    if (!order?.upload_token) {
      return "";
    }

    return `${getBaseUrl()}/upload/${order.upload_token}`;
  }

  function getMemoryUrl() {
    if (!order) {
      return "";
    }

    return `${getBaseUrl()}/memory/${order.public_code}`;
  }

  async function copyUploadLink() {
    const url = getUploadUrl();

    if (!url) return;

    await navigator.clipboard.writeText(
      url
    );

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  function openWhatsApp() {
    if (!order) return;

    const url = getUploadUrl();

    if (!url) return;

    const text = [
      `Hi ${order.customer_name || "there"},`,
      "",
      `Please add your voice message for ${order.recipient_name}.`,
      "",
      url,
      "",
      order.order_number
        ? `Order: ${order.order_number}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        text
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function markLabelPrinted() {
    if (!order || order.label_printed_at || markingPrinted) {
      return;
    }

    setMarkingPrinted(true);
    setError("");

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setMarkingPrinted(false);
      router.replace("/login");
      return;
    }

    const printedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("memories")
      .update({
        label_printed_at: printedAt,
      })
      .eq("id", order.id)
      .eq("created_by", user.id);

    if (updateError) {
      setError(
        `The label print opened, but the order could not be marked as printed: ${updateError.message}`
      );
      setMarkingPrinted(false);
      return;
    }

    setOrder((current) =>
      current
        ? {
            ...current,
            label_printed_at: printedAt,
          }
        : current
    );

    setMarkingPrinted(false);
  }

  async function runQrAction(
    action: "assign" | "activate",
    code: string
  ) {
    if (!order || qrBusy) {
      return;
    }

    const normalizedCode =
      code.trim().toUpperCase();

    if (!normalizedCode) {
      setQrError(
        "Enter the code printed under the pre-made QR label."
      );
      return;
    }

    setQrBusy(true);
    setQrError("");
    setQrSuccess("");

    try {
      const supabase = createClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/qr-assignment",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action,
            memoryId: order.id,
            qrCode: normalizedCode,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to update the QR assignment."
        );
      }

      const updatedQr =
        result.qrCode as AssignedQr;

      setAssignedQr(updatedQr);
      setQrCodeInput(updatedQr.code);

      if (updatedQr.status === "ACTIVE") {
        setQrSuccess(
          `QR ${updatedQr.code} is active and now opens this memory.`
        );
      } else {
        setQrSuccess(
          `QR ${updatedQr.code} has been assigned to this order.`
        );
      }
    } catch (caught) {
      setQrError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the QR assignment."
      );
    } finally {
      setQrBusy(false);
    }
  }

  function getPremadeQrUrl() {
    if (!assignedQr) {
      return "";
    }

    return `${PRODUCTION_APP_URL}/q/${assignedQr.code}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-center text-slate-500">
        Loading order…
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error ||
            "Order not found."}
        </div>
      </main>
    );
  }

  const waiting =
    order.status ===
    "WAITING_FOR_UPLOAD";

  const ready =
    order.status === "READY";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-xl font-bold tracking-widest text-emerald-900"
          >
            MEMORY BLOCK
          </Link>

          <Link
            href="/orders"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            ← Orders
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Order
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              {order.order_number ||
                "Memory order"}
            </h1>
          </div>

          <span
            className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${
              ready
                ? "bg-emerald-100 text-emerald-800"
                : waiting
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200 text-slate-700"
            }`}
          >
            {ready
              ? "● Ready"
              : waiting
                ? "● Waiting for upload"
                : order.status}
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <OrderDetailsCard
            order={order}
            ready={ready}
          />

          {/* Status area */}
          <section>
            {waiting && (
              <div className="rounded-xl border border-amber-200 bg-white p-6">
                <h2 className="text-lg font-semibold">
                  Customer upload
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The customer has not
                  submitted their recording
                  yet.
                </p>

                <div className="mt-5 rounded-lg bg-slate-50 p-4">
                  <p className="break-all text-xs text-slate-600">
                    {getUploadUrl()}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={
                      copyUploadLink
                    }
                    className="rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
                  >
                    {copied
                      ? "Copied ✓"
                      : "Copy upload link"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      openWhatsApp
                    }
                    className="rounded-lg bg-emerald-950 px-4 py-3 font-semibold text-white hover:bg-emerald-900"
                  >
                    Open WhatsApp
                  </button>
                </div>
              </div>
            )}

            {ready && (
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
                          dateStyle:
                            "medium",
                          timeStyle:
                            "short",
                        }
                      ).format(
                        new Date(
                          order.uploaded_at
                        )
                      )}
                    </p>
                  )}
                </div>

                <a
                  href={getMemoryUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block rounded-lg border border-emerald-900 px-4 py-3 text-center font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  Open recipient page
                </a>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Pre-printed QR label
                      </h2>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Optional. Use one of the QR labels you printed in advance instead of printing a new QR for this order.
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
                          setQrCodeInput(
                            event.target.value
                              .toUpperCase()
                              .replace(
                                /[^A-Z0-9]/g,
                                ""
                              )
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
                        onClick={() =>
                          void runQrAction(
                            "assign",
                            qrCodeInput
                          )
                        }
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
                        assignedQr.status ===
                        "ACTIVE"
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
                            assignedQr.status ===
                            "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {assignedQr.status ===
                          "ACTIVE"
                            ? "Active"
                            : "Assigned"}
                        </span>
                      </div>

                      {assignedQr.status ===
                        "ASSIGNED" && (
                        <>
                          <p className="mt-4 text-sm leading-6 text-amber-800">
                            The physical QR is linked to this order, but it will not open the voice memory until you activate it.
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              void runQrAction(
                                "activate",
                                assignedQr.code
                              )
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

                      {assignedQr.status ===
                        "ACTIVE" && (
                        <>
                          <p className="mt-4 text-sm leading-6 text-emerald-800">
                            ✓ This pre-printed QR is active. Scanning the physical label now opens this voice memory.
                          </p>

                          <a
                            href={getPremadeQrUrl()}
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
                      publicCode={
                        order.public_code
                      }
                      recipientName={
                        order.recipient_name
                      }
                      printed={
                        !!order.label_printed_at
                      }
                      markingPrinted={
                        markingPrinted
                      }
                      onPrinted={
                        markLabelPrinted
                      }
                    />
                  </>
                )}

                {order.upload_source === "PREMADE_QR" && (
                  <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                    <p className="font-semibold text-cyan-900">
                      ✓ No new QR label needs to be printed
                    </p>

                    <p className="mt-1 text-sm leading-6 text-cyan-800">
                      This order was created from the pre-printed QR already attached to the physical Memory Block.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}