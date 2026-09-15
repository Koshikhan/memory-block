"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import { createClient } from "@/lib/supabase/client";
import VoiceRecorder from "@/components/VoiceRecorder";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

type CompletedOrder = {
  orderNumber: string;
  publicCode: string;
};

export default function AddMemoryPage() {
  const [customerName, setCustomerName] =
    useState("");

  const [recipientName, setRecipientName] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [customerEmail, setCustomerEmail] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [audioFile, setAudioFile] =
    useState<File | null>(null);

  const [audioUrl, setAudioUrl] =
    useState("");

  const [recordingBusy, setRecordingBusy] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [completedOrder, setCompletedOrder] =
    useState<CompletedOrder | null>(null);

  const previewUrlRef =
    useRef("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(
          previewUrlRef.current
        );
      }
    };
  }, []);

  function clearAudio() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(
        previewUrlRef.current
      );
    }

    previewUrlRef.current = "";

    setAudioUrl("");
    setAudioFile(null);
  }

  function selectAudio(
    file: File | undefined
  ) {
    if (
      !file ||
      submitting ||
      completedOrder
    ) {
      return;
    }

    setError("");

    if (
      !/\.mp3$/i.test(
        file.name
      )
    ) {
      setError(
        "Please choose an MP3 recording."
      );

      return;
    }

    if (file.size === 0) {
      setError(
        "This recording is empty. Please try again."
      );

      return;
    }

    if (
      file.size > MAX_FILE_SIZE
    ) {
      setError(
        "Please choose a recording up to 25 MB."
      );

      return;
    }

    clearAudio();

    const url =
      URL.createObjectURL(file);

    previewUrlRef.current =
      url;

    setAudioFile(file);
    setAudioUrl(url);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submitting ||
      recordingBusy ||
      completedOrder
    ) {
      return;
    }

    setError("");

    const cleanCustomerName =
      customerName.trim();

    const cleanRecipientName =
      recipientName.trim();

    const cleanPhone =
      customerPhone.trim();

    const cleanEmail =
      customerEmail.trim();

    const cleanMessage =
      message.trim();

    if (!cleanCustomerName) {
      setError(
        "Please enter your name."
      );
      return;
    }

    if (!cleanRecipientName) {
      setError(
        "Please enter who this memory is for."
      );
      return;
    }

    if (!cleanPhone) {
      setError(
        "Please enter your mobile number."
      );
      return;
    }

    if (!audioFile) {
      setError(
        "Please record or upload your voice message."
      );
      return;
    }

    setSubmitting(true);

    try {
      /*
       * STEP 1:
       * Ask the server for a secure
       * temporary upload token.
       */
      const prepareResponse =
        await fetch(
          "/api/shop-memory",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action: "prepare",

              fileName:
                audioFile.name,

              fileSize:
                audioFile.size,
            }),
          }
        );

      const prepareResult =
        await prepareResponse.json();

      if (
        !prepareResponse.ok
      ) {
        throw new Error(
          prepareResult.error ||
            "Unable to prepare the recording upload."
        );
      }

      const {
        submissionId,
        path,
        token,
        contentType,
      } = prepareResult;

      /*
       * STEP 2:
       * Upload directly from the
       * customer's phone to private
       * Supabase Storage.
       */
      const supabase =
        createClient();

      const {
        error: uploadError,
      } = await supabase.storage
        .from("voice-notes")
        .uploadToSignedUrl(
          path,
          token,
          audioFile,
          {
            contentType,
          }
        );

      if (uploadError) {
        throw new Error(
          `Recording upload failed: ${uploadError.message}`
        );
      }

      /*
       * STEP 3:
       * Confirm the upload and create
       * the actual Memory Block order.
       */
      const completeResponse =
        await fetch(
          "/api/shop-memory",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action: "complete",

              submissionId,
              path,

              customerName:
                cleanCustomerName,

              customerPhone:
                cleanPhone,

              customerEmail:
                cleanEmail,

              recipientName:
                cleanRecipientName,

              message:
                cleanMessage,
            }),
          }
        );

      const completeResult =
        await completeResponse.json();

      if (
        !completeResponse.ok
      ) {
        throw new Error(
          completeResult.error ||
            "Unable to create your Memory Block order."
        );
      }

      setCompletedOrder({
        orderNumber:
          completeResult.orderNumber,

        publicCode:
          completeResult.publicCode,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please ask a member of staff for help."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (completedOrder) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 px-6 py-12 text-white">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-900">
            ✓
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
            Memory Block
          </p>

          <h1 className="mt-5 font-serif text-4xl">
            Your memory has been received
          </h1>

          <p className="mt-5 leading-7 text-emerald-100">
            Thank you,{" "}
            <strong className="text-white">
              {customerName.trim()}
            </strong>
            .
          </p>

          <p className="mt-2 leading-7 text-emerald-100">
            The team will now prepare your
            Memory Block.
          </p>

          <div className="mt-8 rounded-2xl bg-white/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">
              Order reference
            </p>

            <p className="mt-3 text-3xl font-bold text-white">
              {
                completedOrder.orderNumber
              }
            </p>
          </div>

          <p className="mt-8 text-sm text-emerald-300">
            You can now close this page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-800">
            Memory Block
          </p>

          <h1 className="mt-4 font-serif text-4xl text-emerald-950 sm:text-5xl">
            Create your voice memory
          </h1>

          <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">
            Add your details and record a
            special voice message for
            someone you care about.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          {/* DETAILS */}
          <section>
            <h2 className="text-lg font-semibold">
              Your details
            </h2>

            <div className="mt-5 grid gap-5">
              <label className="grid gap-2 text-sm font-medium">
                Your name

                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(
                      event.target.value
                    )
                  }
                  maxLength={80}
                  placeholder="Your name"
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Who is this memory for?

                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(event) =>
                    setRecipientName(
                      event.target.value
                    )
                  }
                  maxLength={80}
                  placeholder="Recipient's name"
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Mobile number

                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value
                    )
                  }
                  maxLength={30}
                  placeholder="07700 123456"
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Email{" "}
                <span className="font-normal text-slate-400">
                  — optional
                </span>

                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(
                      event.target.value
                    )
                  }
                  maxLength={254}
                  placeholder="you@email.com"
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Short message{" "}
                <span className="font-normal text-slate-400">
                  — optional
                </span>

                <textarea
                  value={message}
                  onChange={(event) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="Happy Birthday! I hope this memory always makes you smile."
                  disabled={submitting}
                  className="resize-y rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                />

                <span className="text-right text-xs font-normal text-slate-400">
                  {message.length}/500
                </span>
              </label>
            </div>
          </section>

          {/* VOICE */}
          <section className="mt-8 border-t border-slate-200 pt-8">
            <h2 className="text-lg font-semibold">
              Your voice message
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Record your message now or
              choose an existing recording.
            </p>

            <div className="mt-5">
              <VoiceRecorder
                disabled={submitting}
                onRecorded={selectAudio}
                onBusyChange={
                  setRecordingBusy
                }
              />
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />

              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Or
              </span>

              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-5">
              <p className="font-semibold text-emerald-950">
                Upload a recording
              </p>

              <p className="mt-2 text-sm text-slate-600">
                MP3 only · up to 25 MB
              </p>

              <input
                type="file"
                accept=".mp3,audio/mpeg"
                disabled={submitting}
                onChange={(event) => {
                  selectAudio(
                    event.target
                      .files?.[0]
                  );

                  event.target.value =
                    "";
                }}
                className="mt-4 block w-full text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-900 file:px-4 file:py-3 file:font-semibold file:text-white"
              />
            </div>

            {audioFile && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      ✓ Voice message ready
                    </p>

                    <p className="mt-1 text-xs text-emerald-700">
                      {(
                        audioFile.size /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={clearAudio}
                    className="text-sm font-medium text-red-700"
                  >
                    Remove
                  </button>
                </div>

                {audioUrl && (
                  <audio
                    controls
                    playsInline
                    preload="metadata"
                    src={audioUrl}
                    className="mt-4 w-full"
                  >
                    Your browser does not
                    support audio playback.
                  </audio>
                )}
              </div>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              recordingBusy ||
              !audioFile
            }
            className="mt-7 w-full rounded-xl bg-emerald-900 px-5 py-4 text-base font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Submitting your memory…"
              : "Submit my memory"}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-slate-400">
            Your recording will be stored
            securely and used only for your
            Memory Block.
          </p>
        </form>
      </div>
    </main>
  );
}
