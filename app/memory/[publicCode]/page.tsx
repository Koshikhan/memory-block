import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    publicCode: string;
  }>;
};

export default async function MemoryPage({
  params,
}: PageProps) {
  const { publicCode } = await params;

  const { data: memory, error: memoryError } =
    await supabaseAdmin
      .from("memories")
      .select(`
        id,
        sender_name,
        recipient_name,
        message,
        audio_path,
        status
      `)
      .eq("public_code", publicCode)
      .maybeSingle();

  if (memoryError) {
    console.error(
      "Unable to load public memory:",
      memoryError
    );

    notFound();
  }

  if (!memory) {
    notFound();
  }

  if (
    memory.status !== "READY" ||
    !memory.audio_path
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 px-6 py-12 text-white">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl">
            🎙️
          </div>

          <h1 className="mt-6 font-serif text-3xl">
            Your voice memory is being prepared
          </h1>

          <p className="mt-4 leading-7 text-emerald-100">
            This special memory is not ready yet.
            Please check again shortly.
          </p>
        </div>
      </main>
    );
  }

  const {
    data: signedAudio,
    error: signedAudioError,
  } = await supabaseAdmin.storage
    .from("voice-notes")
    .createSignedUrl(
      memory.audio_path,
      60 * 60
    );

  if (
    signedAudioError ||
    !signedAudio?.signedUrl
  ) {
    console.error(
      "Unable to create signed audio URL:",
      signedAudioError
    );

    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 px-6 py-12 text-white">
        <div className="w-full max-w-lg text-center">
          <h1 className="font-serif text-3xl">
            This memory is temporarily unavailable
          </h1>

          <p className="mt-4 leading-7 text-emerald-100">
            Please try scanning the QR code again
            in a moment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-emerald-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <section className="w-full text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
            Memory Block
          </p>

          <p className="mt-12 text-sm uppercase tracking-widest text-emerald-200">
            A special voice memory for
          </p>

          <h1 className="mt-4 break-words font-serif text-5xl leading-tight sm:text-6xl">
            {memory.recipient_name}
          </h1>

          {memory.message?.trim() && (
            <p className="mx-auto mt-8 max-w-md whitespace-pre-wrap break-words text-lg leading-8 text-emerald-50">
              {memory.message}
            </p>
          )}

          <div className="mt-10 rounded-2xl bg-white p-5 text-left text-slate-900 shadow-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-emerald-800">
              Voice message
            </p>

            <audio
              controls
              playsInline
              preload="metadata"
              src={signedAudio.signedUrl}
              className="w-full"
            >
              Your browser does not support audio playback.
            </audio>
          </div>

          <p className="mt-10 text-emerald-100">
            With love from
          </p>

          <p className="mt-2 break-words font-serif text-2xl text-white">
            {memory.sender_name}
          </p>

          <div className="mx-auto mt-12 h-px w-20 bg-emerald-700" />

          <p className="mt-6 text-xs leading-5 text-emerald-300">
            A memory made to be heard again and again.
          </p>
        </section>
      </div>
    </main>
  );
}
