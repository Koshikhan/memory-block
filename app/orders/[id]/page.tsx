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
import MemoryQr from "@/components/MemoryQr";

type MemoryOrder = {
  id: string;
  order_number: string | null;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  sender_name: string;
  recipient_name: string;
  message: string | null;

  status: string;

  audio_path: string | null;

  upload_token: string | null;
  upload_expires_at: string | null;

  public_code: string;

  created_at: string;
  uploaded_at: string | null;

  upload_source: string | null;
  label_printed_at: string | null;
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

      const {
        data,
        error,
      } = await supabase
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
        .maybeSingle();

      if (error) {
        setError(error.message);
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
          {/* Details */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">
              Order details
            </h2>

            <dl className="mt-6 grid gap-5">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Customer
                </dt>

                <dd className="mt-1">
                  {order.customer_name ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email
                </dt>

                <dd className="mt-1">
                  {order.customer_email ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Mobile
                </dt>

                <dd className="mt-1">
                  {order.customer_phone ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  From
                </dt>

                <dd className="mt-1">
                  {order.sender_name}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  For
                </dt>

                <dd className="mt-1">
                  {
                    order.recipient_name
                  }
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Message
                </dt>

                <dd className="mt-1 whitespace-pre-wrap">
                  {order.message ||
                    "No message"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Created
                </dt>

                <dd className="mt-1">
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
                      order.created_at
                    )
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Source
                </dt>

                <dd className="mt-1">
                  {order.upload_source === "SHOP_QR"
                    ? "In-store QR"
                    : order.upload_source === "PRIVATE_LINK"
                      ? "Private link"
                      : order.upload_source === "STAFF"
                        ? "Staff"
                        : "Unknown"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Label
                </dt>

                <dd className="mt-1">
                  {order.label_printed_at ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      Printed
                    </span>
                  ) : ready ? (
                    <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                      To print
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      Not ready
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

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
          </section>
        </div>
      </div>
    </main>
  );
}