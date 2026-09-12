import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{
    code: string;
  }>;
};

export default async function PremadeQrPage({
  params,
}: Props) {
  const { code } = await params;

  const normalizedCode = code
    .trim()
    .toUpperCase();

  const {
    data: qrCode,
    error: qrError,
  } = await supabaseAdmin
    .from("qr_codes")
    .select(`
      id,
      code,
      status,
      memory_id
    `)
    .eq("code", normalizedCode)
    .maybeSingle();

  if (qrError) {
    console.error(
      "Unable to load pre-made QR:",
      qrError
    );

    return (
      <main className="min-h-screen bg-emerald-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl bg-white p-8 text-center text-slate-900 shadow-xl">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
              Memory Block
            </p>

            <h1 className="mt-5 text-3xl font-semibold">
              We could not open this Memory Block
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              Please try scanning the QR code again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!qrCode) {
    notFound();
  }

  if (
    qrCode.status === "ACTIVE" &&
    qrCode.memory_id
  ) {
    const {
      data: memory,
      error: memoryError,
    } = await supabaseAdmin
      .from("memories")
      .select(`
        public_code,
        status,
        audio_path
      `)
      .eq("id", qrCode.memory_id)
      .maybeSingle();

    if (memoryError) {
      console.error(
        "Unable to resolve active QR memory:",
        memoryError
      );
    }

    if (
      memory &&
      memory.status === "READY" &&
      memory.audio_path
    ) {
      redirect(
        `/memory/${memory.public_code}`
      );
    }

    return (
      <main className="min-h-screen bg-emerald-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl bg-white p-8 text-center text-slate-900 shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
              ◷
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
              Memory Block
            </p>

            <h1 className="mt-4 text-3xl font-semibold">
              Your memory is being prepared
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              This QR code has been activated, but the voice memory is not ready yet.
              Please try again shortly.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (qrCode.status === "VOID") {
    return (
      <main className="min-h-screen bg-emerald-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl bg-white p-8 text-center text-slate-900 shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-700">
              ×
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
              Memory Block
            </p>

            <h1 className="mt-4 text-3xl font-semibold">
              This QR code is no longer active
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              Please contact the Memory Block team if you believe this is a mistake.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const assigned =
    qrCode.status === "ASSIGNED";

  return (
    <main className="min-h-screen bg-emerald-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl bg-white p-8 text-center text-slate-900 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-800">
            {assigned ? "◷" : "✓"}
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
            Memory Block
          </p>

          <h1 className="mt-4 text-3xl font-semibold">
            {assigned
              ? "Your Memory Block is being prepared"
              : "This Memory Block is ready to be activated"}
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            {assigned
              ? "This QR code has been assigned to a memory. It will become active once the Memory Block is ready."
              : "This is a valid pre-printed Memory Block QR code. It has not been assigned to a voice memory yet."}
          </p>

          <div className="mt-7 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              QR code
            </p>

            <p className="mt-2 font-mono text-lg font-bold tracking-[0.2em] text-emerald-950">
              {qrCode.code}
            </p>
          </div>

          <Link
            href="/"
            className="mt-7 inline-flex rounded-xl border border-emerald-900 px-5 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Memory Block
          </Link>
        </div>
      </div>
    </main>
  );
}
