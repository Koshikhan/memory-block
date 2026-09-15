"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

type Props = {
  code: string;
};

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  return (
    candidates.find((type) =>
      MediaRecorder.isTypeSupported(type)
    ) || ""
  );
}

export default function PremadeQrVoiceUpload({
  code,
}: Props) {
  const [customerName, setCustomerName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string | null;
  } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!audioFile) {
      setAudioUrl("");
      return;
    }

    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  function selectAudio(file: File | undefined) {
    setError("");

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError("The voice recording must be 25 MB or smaller.");
      return;
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "";

    const allowed = ["mp3"];

    if (!allowed.includes(extension)) {
      setError(
        "Please use an MP3 audio file."
      );
      return;
    }

    setAudioFile(file);
  }

  async function startRecording() {
    setError("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Voice recording is not supported in this browser. You can upload an audio file instead."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
          })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalType =
          recorder.mimeType ||
          mimeType ||
          "audio/webm";

        const blob = new Blob(
          chunksRef.current,
          {
            type: finalType,
          }
        );

        const extension =
          getExtensionFromMimeType(finalType);

        const file = new File(
          [blob],
          `memory-recording-${Date.now()}.${extension}`,
          {
            type: finalType,
          }
        );

        stream.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];

        if (file.size > MAX_FILE_SIZE) {
          setError(
            "The recording is larger than 25 MB. Please record a shorter message."
          );
          return;
        }

        setAudioFile(file);
      };

      recorder.start();

      setRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current + 1;

          if (next >= 120) {
            stopRecording();
          }

          return next;
        });
      }, 1000);
    } catch {
      setError(
        "Microphone access was not available. Please allow microphone access or upload an audio file."
      );
    }
  }

  function stopRecording() {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setRecording(false);
  }

  async function submitMemory(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) return;

    setError("");

    if (!customerName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!recipientName.trim()) {
      setError(
        "Please enter who this Memory Block is for."
      );
      return;
    }

    if (!customerPhone.trim()) {
      setError("Please enter your mobile number.");
      return;
    }

    if (!audioFile) {
      setError(
        "Please record or upload a voice message."
      );
      return;
    }

    setSubmitting(true);

    try {
      const endpoint =
        `/api/premade-qr-memory/${encodeURIComponent(code)}`;

      const prepareResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prepare",
          fileName: audioFile.name,
          fileSize: audioFile.size,
        }),
      });

      const prepareResult =
        await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(
          prepareResult?.error ||
            "Unable to prepare the voice upload."
        );
      }

      const supabase = createClient();

      const {
        error: uploadError,
      } = await supabase.storage
        .from("voice-notes")
        .uploadToSignedUrl(
          prepareResult.path,
          prepareResult.token,
          audioFile,
          {
            contentType:
              prepareResult.contentType ||
              audioFile.type ||
              "application/octet-stream",
          }
        );

      if (uploadError) {
        throw new Error(
          `Voice upload failed: ${uploadError.message}`
        );
      }

      const completeResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
          submissionId:
            prepareResult.submissionId,
          path: prepareResult.path,
          customerName:
            customerName.trim(),
          customerPhone:
            customerPhone.trim(),
          customerEmail:
            customerEmail.trim(),
          recipientName:
            recipientName.trim(),
          message:
            message.trim(),
        }),
      });

      const completeResult =
        await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(
          completeResult?.error ||
            "Unable to save your Memory Block."
        );
      }

      setCompletedOrder({
        orderNumber:
          completeResult.memory?.order_number ??
          null,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save your Memory Block."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (completedOrder) {
    return (
      <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-900 text-2xl font-bold text-white">
          ✓
        </div>

        <h2 className="mt-5 text-2xl font-bold text-emerald-950">
          Your voice memory has been added
        </h2>

        <p className="mt-3 leading-7 text-slate-600">
          This QR is now connected to your voice memory. The same QR already attached to the Memory Block can be used from now on.
        </p>

        {completedOrder.orderNumber && (
          <div className="mt-5 rounded-xl bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Order reference
            </p>

            <p className="mt-1 text-xl font-bold text-emerald-950">
              {completedOrder.orderNumber}
            </p>
          </div>
        )}

        <a
          href={`/q/${encodeURIComponent(code)}`}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 font-semibold text-white hover:bg-emerald-900"
        >
          Test this Memory Block
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitMemory}
      className="mt-8 text-left"
    >
      <div className="grid gap-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Your name
          </label>

          <input
            type="text"
            value={customerName}
            onChange={(event) =>
              setCustomerName(event.target.value)
            }
            required
            maxLength={120}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Who is this Memory Block for?
          </label>

          <input
            type="text"
            value={recipientName}
            onChange={(event) =>
              setRecipientName(event.target.value)
            }
            required
            maxLength={120}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Mobile number
          </label>

          <input
            type="tel"
            value={customerPhone}
            onChange={(event) =>
              setCustomerPhone(event.target.value)
            }
            required
            maxLength={50}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <span className="ml-1 font-normal text-slate-400">
              optional
            </span>
          </label>

          <input
            type="email"
            value={customerEmail}
            onChange={(event) =>
              setCustomerEmail(event.target.value)
            }
            maxLength={254}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Short message
            <span className="ml-1 font-normal text-slate-400">
              optional
            </span>
          </label>

          <textarea
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            maxLength={2000}
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-900">
            Voice message
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Record a message now or upload an existing audio file.
          </p>

          {!recording ? (
            <button
              type="button"
              onClick={() =>
                void startRecording()
              }
              disabled={submitting}
              className="mt-4 w-full rounded-xl bg-emerald-950 px-4 py-3 font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              🎙 Record voice message
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500"
            >
              ■ Stop recording ({recordingSeconds}s)
            </button>
          )}

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              or
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <label className="block">
            <span className="sr-only">
              Upload voice file
            </span>

            <input
              type="file"
              accept=".mp3,audio/mpeg"
              onChange={(event) =>
                selectAudio(
                  event.target.files?.[0]
                )
              }
              disabled={recording || submitting}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-emerald-900 hover:file:bg-emerald-50"
            />
          </label>

          {audioUrl && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Preview
              </p>

              <audio
                controls
                playsInline
                preload="metadata"
                src={audioUrl}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={
          submitting ||
          recording ||
          !audioFile
        }
        className="mt-6 w-full rounded-xl bg-emerald-950 px-5 py-4 text-base font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Saving your memory…"
          : "Activate my Memory Block"}
      </button>

      <p className="mt-3 text-center text-xs text-slate-400">
        Your voice recording is securely stored and linked only to this Memory Block QR.
      </p>
    </form>
  );
}
