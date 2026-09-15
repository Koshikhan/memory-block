import type {
    MemoryOrder,
    MemorySource,
  } from "@/types/memory";
  
  type OrderDetails = Pick<
    MemoryOrder,
    | "customer_name"
    | "customer_email"
    | "customer_phone"
    | "sender_name"
    | "recipient_name"
    | "message"
    | "created_at"
    | "upload_source"
    | "label_printed_at"
  >;
  
  type Props = {
    order: OrderDetails;
    ready: boolean;
  };
  
  function sourceLabel(
    source: MemorySource | null
  ) {
    switch (source) {
      case "SHOP_QR":
        return "In-store QR";
      case "PREMADE_QR":
        return "Pre-made QR";
      case "PRIVATE_LINK":
        return "Private link";
      case "STAFF":
        return "Staff";
      default:
        return "Unknown";
    }
  }
  
  export default function OrderDetailsCard({
    order,
    ready,
  }: Props) {
    return (
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
              {order.customer_name || "—"}
            </dd>
          </div>
  
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Email
            </dt>
  
            <dd className="mt-1">
              {order.customer_email || "—"}
            </dd>
          </div>
  
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mobile
            </dt>
  
            <dd className="mt-1">
              {order.customer_phone || "—"}
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
              {order.recipient_name}
            </dd>
          </div>
  
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Message
            </dt>
  
            <dd className="mt-1 whitespace-pre-wrap">
              {order.message || "No message"}
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
                  dateStyle: "medium",
                  timeStyle: "short",
                }
              ).format(
                new Date(order.created_at)
              )}
            </dd>
          </div>
  
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Source
            </dt>
  
            <dd className="mt-1">
              {sourceLabel(order.upload_source)}
            </dd>
          </div>
  
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Label
            </dt>
  
            <dd className="mt-1">
              {order.upload_source ===
                "PREMADE_QR" && ready ? (
                <span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                  Pre-printed QR attached
                </span>
              ) : order.label_printed_at ? (
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
    );
  }
  