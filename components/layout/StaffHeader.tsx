"use client";

import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type StaffSection =
  | "home"
  | "orders"
  | "qr-inventory";

type Props = {
  current?: StaffSection;
  maxWidth?: "6xl" | "7xl";
};

export default function StaffHeader({
  current = "home",
  maxWidth = "6xl",
}: Props) {
  const widthClass =
    maxWidth === "7xl"
      ? "max-w-7xl"
      : "max-w-6xl";

  function navClass(
    section: StaffSection
  ) {
    const active =
      current === section;

    return active
      ? "rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
      : "rounded-lg border border-emerald-900 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50";
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div
        className={`mx-auto flex ${widthClass} items-center justify-between px-6 py-5`}
      >
        <Link
          href="/"
          className="text-xl font-bold tracking-widest text-emerald-900"
        >
          MEMORY BLOCK
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className={navClass("orders")}
          >
            Orders
          </Link>

          <Link
            href="/qr-inventory"
            className={navClass(
              "qr-inventory"
            )}
          >
            QR Inventory
          </Link>

          <span className="hidden text-sm text-slate-500 lg:inline">
            Staff workspace
          </span>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
