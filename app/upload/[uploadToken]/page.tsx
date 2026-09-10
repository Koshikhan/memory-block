import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabase/admin";
import CustomerVoiceUpload from "@/components/CustomerVoiceUpload";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    uploadToken: string;
  }>;
};

export default async function CustomerUploadPage({
  params,
}: PageProps) {
  const { uploadToken } =
    await params;

  const {
    data: memory,
    error,
  } = await supabaseAdmin
    .from("memories")
    .select(
      `
        customer_name,
        recipient_name,
        order_number,
        status,
        audio_path,
        upload_expires_at
      `
    )
    .eq(
      "upload_token",
      uploadToken
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Customer upload lookup failed:",
      error
    );

    throw new Error(
      "Unable to load this upload."
    );
  }

  if (!memory) {
    notFound();
  }

  const expired =
    memory.upload_expires_at
      ? new Date(
          memory.upload_expires_at
        ).getTime() < Date.now()
      : false;

  const complete =
    memory.status === "READY" ||
    !!memory.audio_path;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f5ef] px-5 py-8 text-slate-900 sm:py-12">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-lg">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-950">
            Memory Block
          </p>
        </header>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
          {complete ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-900">
                ✓
              </div>

              <h1 className="mt-6 text-2xl font-semibold">
                Voice memory received
              </h1>

              <p className="mt-3 leading-7 text-slate-600">
                Your voice message has
                already been submitted
                successfully.
              </p>

              <p className="mt-5 text-sm text-slate-500">
                You can close this page.
              </p>
            </div>
          ) : expired ? (
            <div className="py-8 text-center">
              <div className="text-4xl">
                ⏳
              </div>

              <h1 className="mt-6 text-2xl font-semibold">
                Upload link expired
              </h1>

              <p className="mt-3 leading-7 text-slate-600">
                Please contact the store
                for a new upload link.
              </p>

              {memory.order_number && (
                <p className="mt-5 text-sm text-slate-500">
                  Order{" "}
                  {memory.order_number}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">
                  🎙️
                </div>

                <p className="mt-6 text-sm text-slate-500">
                  Hi{" "}
                  {memory.customer_name ||
                    "there"}
                </p>

                <h1 className="mt-2 font-serif text-3xl text-emerald-950">
                  Add your voice memory
                </h1>

                <p className="mt-4 leading-7 text-slate-600">
                  Record or upload a
                  special voice message
                  for{" "}
                  <strong className="text-slate-900">
                    {
                      memory.recipient_name
                    }
                  </strong>
                  .
                </p>

                {memory.order_number && (
                  <p className="mt-3 text-xs text-slate-400">
                    Order{" "}
                    {
                      memory.order_number
                    }
                  </p>
                )}
              </div>

              <div className="my-7 h-px bg-slate-200" />

              <CustomerVoiceUpload
                uploadToken={
                  uploadToken
                }
                recipientName={
                  memory.recipient_name
                }
              />
            </>
          )}
        </section>

        <p className="mt-7 text-center text-xs text-slate-400">
          Your recording is private and
          attached only to this Memory
          Block.
        </p>
      </div>
    </main>
  );
}