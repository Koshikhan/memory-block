"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import VoiceRecorder from "@/components/VoiceRecorder";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

type Props = {
  uploadToken: string;
  recipientName: string;
};

export default function CustomerVoiceUpload({
  uploadToken,
  recipientName,
}: Props) {
  const [audioFile, setAudioFile] =
    useState<File | null>(null);

  const [audioUrl, setAudioUrl] =
    useState("");

  const [recordingBusy, setRecordingBusy] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [error, setError] =
    useState("");

  const previewUrlRef = useRef("");

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

  function storeAudio(
    file: File
  ) {
    clearAudio();

    const url =
      URL.createObjectURL(file);

    previewUrlRef.current = url;

    setAudioFile(file);
    setAudioUrl(url);
  }

  function validateCommonAudio(
    file: File
  ): boolean {
    if (file.size === 0) {
      setError(
        "This recording is empty."
      );
      return false;
    }

    if (
      file.size > MAX_FILE_SIZE
    ) {
      setError(
        "Please choose a recording up to 25 MB."
      );
      return false;
    }

    return true;
  }

  function selectAudio(
    file: File | undefined
  ) {
    if (
      !file ||
      uploading ||
      submitted
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

    if (!validateCommonAudio(file)) {
      return;
    }

    storeAudio(file);
  }

  function selectRecordedAudio(
    file: File | undefined
  ) {
    if (
      !file ||
      uploading ||
      submitted
    ) {
      return;
    }

    setError("");

    if (!validateCommonAudio(file)) {
      return;
    }

    storeAudio(file);
  }

  async function submitRecording() {
    if (
      !audioFile ||
      uploading ||
      recordingBusy
    ) {
      return;
    }

    setError("");
    setUploading(true);

    try {
      /*
       * Ask our server for a temporary
       * signed Supabase upload token.
       */
      const prepareResponse =
        await fetch(
          `/api/customer-upload/${encodeURIComponent(
            uploadToken
          )}`,
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

      const prepareData =
        await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(
          prepareData.error ||
            "Unable to prepare the upload."
        );
      }

      /*
       * Upload directly from the
       * customer's phone to Supabase.
       */
      const supabase =
        createClient();

      const {
        error: uploadError,
      } = await supabase.storage
        .from("voice-notes")
        .uploadToSignedUrl(
          prepareData.path,
          prepareData.token,
          audioFile,
          {
            contentType:
              prepareData.contentType,
          }
        );

      if (uploadError) {
        throw new Error(
          `Recording upload failed: ${uploadError.message}`
        );
      }

      /*
       * Tell our server that the upload
       * completed.
       */
      const completeResponse =
        await fetch(
          `/api/customer-upload/${encodeURIComponent(
            uploadToken
          )}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "complete",
              path: prepareData.path,
            }),
          }
        );

      const completeData =
        await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(
          completeData.error ||
            "Unable to complete the memory."
        );
      }

      setSubmitted(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to upload your recording."
      );
    } finally {
      setUploading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-900">
          ✓
        </div>

        <h2 className="mt-6 text-2xl font-semibold text-slate-900">
          Voice memory received
        </h2>

        <p className="mt-3 leading-7 text-slate-600">
          Your voice message for{" "}
          <strong>
            {recipientName}
          </strong>{" "}
          has been received successfully.
        </p>

        <p className="mt-5 text-sm text-slate-500">
          You can now close this page.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Upload existing audio */}
      <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5">
        <p className="font-semibold text-emerald-950">
          Upload a recording
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose an existing voice
          recording from your phone.
        </p>

        <input
          type="file"
          accept=".mp3,audio/mpeg"
          disabled={
            uploading ||
            recordingBusy
          }
          onChange={(event) => {
            selectAudio(
              event.target.files?.[0]
            );

            event.target.value =
              "";
          }}
          className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-950 file:px-4 file:py-3 file:font-semibold file:text-white"
        />
      </div>

      {/* OR */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />

        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Or
        </span>

        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Live recording */}
      <VoiceRecorder
        disabled={uploading}
        onRecorded={selectRecordedAudio}
        onBusyChange={
          setRecordingBusy
        }
      />

      {/* Preview */}
      {audioFile && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                Your recording
              </p>

              <p className="mt-1 truncate text-sm text-slate-500">
                {audioFile.name}
              </p>
            </div>

            <button
              type="button"
              disabled={
                uploading ||
                recordingBusy
              }
              onClick={() => {
                clearAudio();
                setError("");
              }}
              className="text-sm font-semibold text-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          </div>

          <audio
            controls
            playsInline
            preload="metadata"
            src={audioUrl}
            className="mt-5 w-full"
          >
            Your browser does not
            support audio playback.
          </audio>

          <p className="mt-3 text-xs text-slate-500">
            Listen to your message before submitting it.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submitRecording}
        disabled={
          !audioFile ||
          uploading ||
          recordingBusy
        }
        className="mt-6 w-full rounded-xl bg-emerald-950 px-5 py-4 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading
          ? "Uploading your memory…"
          : recordingBusy
            ? "Finish recording first"
            : "Submit voice memory"}
      </button>

      {uploading && (
        <p
          role="status"
          className="mt-4 text-center text-sm text-slate-500"
        >
          Keep this page open while your recording uploads.
        </p>
      )}
    </div>
  );
}
