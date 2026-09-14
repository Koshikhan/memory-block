"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import StaffHeader from "@/components/layout/StaffHeader";
import type { MemoryOrder as MemoryOrderRecord } from "@/types/memory";

type MemoryOrder = Pick<
  MemoryOrderRecord,
  | "id"
  | "order_number"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "sender_name"
  | "recipient_name"
  | "status"
  | "audio_path"
  | "upload_token"
  | "public_code"
  | "created_at"
  | "uploaded_at"
  | "upload_source"
  | "label_printed_at"
>;

function statusStyles(status: string) {
  switch (status) {
    case "READY":
      return "bg-emerald-100 text-emerald-800";
    case "WAITING_FOR_UPLOAD":
      return "bg-amber-100 text-amber-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    case "ARCHIVED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "READY":
      return "Ready";
    case "WAITING_FOR_UPLOAD":
      return "Waiting for upload";
    case "CANCELLED":
      return "Cancelled";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

function sourceLabel(source: string | null) {
  switch (source) {
    case "STAFF":
      return "Staff";
    case "PRIVATE_LINK":
      return "Private link";
    case "SHOP_QR":
      return "In-store QR";
    case "PREMADE_QR":
      return "Pre-made QR";
    default:
      return "Unknown";
  }
}

function sourceStyles(source: string | null) {
  switch (source) {
    case "SHOP_QR":
      return "bg-violet-100 text-violet-800";
    case "PREMADE_QR":
      return "bg-cyan-100 text-cyan-800";
    case "PRIVATE_LINK":
      return "bg-blue-100 text-blue-800";
    case "STAFF":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function labelStatus(order: MemoryOrder) {
  if (order.status !== "READY" || !order.audio_path) {
    return {
      label: "Not ready",
      classes: "bg-slate-100 text-slate-600",
    };
  }

  if (order.upload_source === "PREMADE_QR") {
    return {
      label: "Pre-printed",
      classes: "bg-cyan-100 text-cyan-800",
    };
  }

  if (order.label_printed_at) {
    return {
      label: "Printed",
      classes: "bg-emerald-100 text-emerald-800",
    };
  }

  return {
    label: "To print",
    classes: "bg-orange-100 text-orange-800",
  };
}

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<MemoryOrder[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startOrders() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const userId = user.id;

      async function loadOrders(showLoading = false) {
        if (showLoading) {
          setLoading(true);
        }

        const { data, error } = await supabase
          .from("memories")
          .select(`
            id,
            order_number,
            customer_name,
            customer_email,
            customer_phone,
            sender_name,
            recipient_name,
            status,
            audio_path,
            upload_token,
            public_code,
            created_at,
            uploaded_at,
            upload_source,
            label_printed_at
          `)
          .eq("created_by", userId)
          .order("created_at", {
            ascending: false,
          });

        if (!active) return;

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        setOrders(data ?? []);
        setError("");
        setLoading(false);
      }

      await loadOrders();

      if (!active) return;

      channel = supabase
        .channel(`orders-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memories",
            filter: `created_by=eq.${userId}`,
          },
          () => {
            void loadOrders();
          }
        )
        .subscribe();
    }

    void startOrders();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [router]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return orders;
    }

    return orders.filter((order) => {
      const label = labelStatus(order).label;

      return [
        order.order_number,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        order.sender_name,
        order.recipient_name,
        order.status,
        sourceLabel(order.upload_source),
        label,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(term)
        );
    });
  }, [orders, search]);

  const waitingCount = orders.filter(
    (order) => order.status === "WAITING_FOR_UPLOAD"
  ).length;

  const readyCount = orders.filter(
    (order) => order.status === "READY"
  ).length;

  const readyToPrintCount = orders.filter(
    (order) =>
      order.status === "READY" &&
      !!order.audio_path &&
      order.upload_source !== "PREMADE_QR" &&
      !order.label_printed_at
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <StaffHeader
        current="orders"
        maxWidth="7xl"
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Orders
            </h1>

            <p className="mt-2 text-slate-600">
              View and manage all Memory Block orders.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-950 px-5 py-3 font-semibold text-white hover:bg-emerald-900"
          >
            + Create new memory
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Total orders
            </p>
            <p className="mt-2 text-3xl font-bold">
              {orders.length}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm text-amber-700">
              Waiting for upload
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {waitingCount}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm text-emerald-700">
              Ready
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {readyCount}
            </p>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
            <p className="text-sm text-orange-700">
              Ready to print
            </p>
            <p className="mt-2 text-3xl font-bold text-orange-900">
              {readyToPrintCount}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <label className="block text-sm font-semibold">
            Search orders
          </label>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Order, customer, recipient, source, status or label..."
            className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Loading orders…
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="font-semibold text-slate-700">
              No orders found
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Create a new memory or try another search.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Order</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Recipient</th>
                    <th className="px-5 py-4">Source</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Label</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const printStatus =
                      labelStatus(order);

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold">
                            {order.order_number ||
                              "No order number"}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {order.id.slice(0, 8)}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium">
                            {order.customer_name || "—"}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {order.customer_phone ||
                              order.customer_email ||
                              "No contact"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium">
                            {order.recipient_name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            From {order.sender_name}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${sourceStyles(
                              order.upload_source
                            )}`}
                          >
                            {sourceLabel(
                              order.upload_source
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles(
                              order.status
                            )}`}
                          >
                            {statusLabel(
                              order.status
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${printStatus.classes}`}
                          >
                            {printStatus.label}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {new Intl.DateTimeFormat(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          ).format(
                            new Date(order.created_at)
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/orders/${order.id}`}
                            className="inline-flex rounded-lg border border-emerald-900 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                          >
                            Open order
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
      </div>
    </main>
  );
}
