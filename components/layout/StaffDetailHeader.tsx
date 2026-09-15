import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type Props = {
  backHref: string;
  backLabel: string;
  maxWidth?: "5xl" | "7xl";
};

export default function StaffDetailHeader({
  backHref,
  backLabel,
  maxWidth = "7xl",
}: Props) {
  const widthClass =
    maxWidth === "5xl"
      ? "max-w-5xl"
      : "max-w-7xl";

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
            href={backHref}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← {backLabel}
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
