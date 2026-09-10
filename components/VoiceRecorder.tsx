"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  disabled: boolean;
  onRecorded: (file: File) => void;
  onBusyChange: (busy: boolean) => void;
};

export default function VoiceRecorder({
  disabled,
  onRecorded,
  onBusyChange,
}: Props) {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "recording" | "stopping"
  >("idle");
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const recorder = recorderRef.current;

      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;

        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }

      releaseMicrophone();
    };
  }, []);

  function stopRecording() {
    const recorder = recorderRef.current;

    if (recorder && recorder.state === "recording") {
      setStatus("stopping");
      recorder.stop();
      releaseMicrophone();
    }
  }

  async function startRecording() {
    if (disabled || busyRef.current) return;

    setError("");

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Recording requires a supported browser and HTTPS or localhost.");
      return;
    }

    busyRef.current = true;
    onBusyChange(true);
    setStatus("requesting");

    try {
      const mimeType = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      if (!mimeType) {
        throw new Error(
          "This browser cannot record a supported audio format. Upload a file instead."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      const chunks: Blob[] = [];
      let failed = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        failed = true;
        releaseMicrophone();

        if (mountedRef.current) {
          setError("Recording failed. Please try again.");
        }
      };

      recorder.onstop = () => {
        releaseMicrophone();
        recorderRef.current = null;
        busyRef.current = false;

        if (!mountedRef.current) return;

        setStatus("idle");
        onBusyChange(false);

        if (failed) return;

        const type = recorder.mimeType || mimeType;
        const blob = new Blob(chunks, { type });

        if (blob.size === 0) {
          setError("No audio was captured. Please try again.");
          return;
        }

        const extension = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";

        onRecorded(
          new File([blob], `voice-recording-${Date.now()}.${extension}`, {
            type,
          })
        );
      };

      recorder.start(1000);
      setStatus("recording");

      timeoutRef.current = setTimeout(stopRecording, 120_000);
    } catch (error) {
      releaseMicrophone();
      recorderRef.current = null;
      busyRef.current = false;

      if (!mountedRef.current) return;

      setStatus("idle");
      onBusyChange(false);
      setError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser settings."
          : error instanceof Error
            ? error.message
            : "Unable to start recording."
      );
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 p-5">
      <p className="font-semibold">Or record a voice note</p>
      <p className="mt-2 text-sm text-slate-500">
        Record up to 2 minutes, then preview before saving.
      </p>

      <button
        type="button"
        disabled={
          disabled || status === "requesting" || status === "stopping"
        }
        onClick={
          status === "recording" ? stopRecording : startRecording
        }
        className={`mt-4 rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-50 ${
          status === "recording"
            ? "bg-red-700 hover:bg-red-800"
            : "bg-emerald-900 hover:bg-emerald-800"
        }`}
      >
        {status === "requesting"
          ? "Waiting for microphone…"
          : status === "recording"
            ? "Stop recording"
            : status === "stopping"
              ? "Preparing preview…"
              : "Record now"}
      </button>

      <p role="status" className="mt-3 text-sm text-slate-600">
        {status === "recording"
          ? "Recording… Speak into your microphone."
          : ""}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
