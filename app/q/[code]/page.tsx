import { notFound, redirect } from "next/navigation";

import PremadeQrVoiceUpload from "@/components/PremadeQrVoiceUpload";
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

  const normalizedCode =
    code.trim().toUpperCase();

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
      <main className="min-h-screen bg-emerald-950 px-6 py-12">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
            Memory Block
          </p>

          <h1 className="mt-5 text-3xl font-semibold text-slate-900">
            We could not open this Memory Block
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            Please try scanning the QR code again.
          </p>
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
      <main className="min-h-screen bg-emerald-950 px-6 py-12">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
            ◷
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
            Memory Block
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Your memory is being prepared
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            This QR has been activated, but the voice memory is not ready yet. Please try again shortly.
          </p>
        </div>
      </main>
    );
  }

  if (qrCode.status === "ASSIGNED") {
    return (
      <main className="min-h-screen bg-emerald-950 px-6 py-12">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
            ◷
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
            Memory Block
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Your Memory Block is being prepared
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            This QR has already been assigned to a memory and will become available once preparation is complete.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              QR code
            </p>

            <p className="mt-2 font-mono text-lg font-bold tracking-[0.2em] text-emerald-950">
              {qrCode.code}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (qrCode.status === "VOID") {
    return (
      <main className="min-h-screen bg-emerald-950 px-6 py-12">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-700">
            ×
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
            Memory Block
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            This QR code is no longer active
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            Please contact the Memory Block team if you believe this is a mistake.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-emerald-950 px-5 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-800">
              ♪
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-emerald-800">
              Memory Block
            </p>

            <h1 className="mt-4 text-3xl font-semibold text-slate-900">
              Add your voice memory
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              Record or upload your message. Once submitted, this exact QR already attached to your Memory Block will become connected to your voice.
            </p>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your Memory Block QR
              </p>

              <p className="mt-2 font-mono text-lg font-bold tracking-[0.2em] text-emerald-950">
                {qrCode.code}
              </p>
            </div>
          </div>

          <PremadeQrVoiceUpload
            code={qrCode.code}
          />
        </div>
      </div>
    </main>
  );
}
