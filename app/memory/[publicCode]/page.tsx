"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  createMemory,
  createPendingMemory,
} from "@/lib/memories";

import VoiceRecorder from "@/components/VoiceRecorder";
import MemoryQr from "@/components/MemoryQr";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

type CreationMode = "STAFF" | "CUSTOMER";

type StaffMemory = Awaited<ReturnType<typeof createMemory>>;
type PendingMemory = Awaited<
  ReturnType<typeof createPendingMemory>
>;

type SavedMemory = StaffMemory | PendingMemory;

export default function Home() {
  // Order
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Memory
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");

  // How the audio will be added
  const [creationMode, setCreationMode] =
    useState<CreationMode>("STAFF");

  // Audio
  const [audioFile, setAudioFile] =
    useState<File | null>(null);

  const [audioUrl, setAudioUrl] = useState("");

  // UI
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recordingBusy, setRecordingBusy] =
    useState(false);

  const [savedMemory, setSavedMemory] =
    useState<SavedMemory | null>(null);

  const [customerUploadUrl, setCustomerUploadUrl] =
    useState("");

  const [copied, setCopied] = useState(false);

  const previewUrlRef = useRef("");
  const submittingRef = useRef(false);

  const locked = saving || savedMemory !== null;

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

  function selectAudio(file: File | undefined) {
    if (!file || locked) return;

    setError("");

    if (
      !/\.(mp3|m4a|wav|ogg|opus|webm)$/i.test(
        file.name
      )
    ) {
      setError(
        "Please choose an MP3, M4A, WAV, OGG, OPUS or WebM file."
      );
      return;
    }

    if (file.size === 0) {
      setError(
        "This file is empty. Please choose another recording."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "Please choose a recording up to 25 MB."
      );
      return;
    }

    clearAudio();

    const url = URL.createObjectURL(file);

    previewUrlRef.current = url;

    setAudioFile(file);
    setAudioUrl(url);
  }

  function changeCreationMode(
    mode: CreationMode
  ) {
    if (locked) return;

    setError("");
    setCreationMode(mode);

    if (mode === "CUSTOMER") {
      clearAudio();
      setRecordingBusy(false);
    }
  }

  function getBaseUrl() {
    const configuredBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(
        /\/$/,
        ""
      );

    return (
      configuredBaseUrl ||
      window.location.origin
    );
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submittingRef.current ||
      savedMemory ||
      recordingBusy
    ) {
      return;
    }

    setError("");

    if (
      creationMode === "STAFF" &&
      !audioFile
    ) {
      setError(
        "Please upload or record a voice note first."
      );
      return;
    }

    submittingRef.current = true;
    setSaving(true);

    try {
      const commonDetails = {
        orderNumber,
        customerName,
        customerEmail,
        customerPhone,
        sender,
        recipient,
        message,
      };

      if (creationMode === "STAFF") {
        if (!audioFile) {
          throw new Error(
            "Please upload or record a voice note first."
          );
        }

        const memory = await createMemory({
          ...commonDetails,
          audioFile,
        });

        setSavedMemory(memory);
      } else {
        const memory =
          await createPendingMemory(
            commonDetails
          );

        setSavedMemory(memory);

        const baseUrl = getBaseUrl();

        setCustomerUploadUrl(
          `${baseUrl}/upload/${memory.uploadToken}`
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create this memory. Please try again."
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  async function copyUploadLink() {
    if (!customerUploadUrl) return;

    try {
      await navigator.clipboard.writeText(
        customerUploadUrl
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError(
        "Unable to copy the upload link."
      );
    }
  }

  function openWhatsApp() {
    if (!customerUploadUrl) return;

    const text = [
      `Hi ${customerName.trim() || "there"},`,
      "",
      `Please add your voice message for ${recipient.trim() || "your Memory Block"}.`,
      "",
      customerUploadUrl,
      "",
      orderNumber.trim()
        ? `Order: ${orderNumber.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const whatsappUrl =
      `https://wa.me/?text=${encodeURIComponent(
        text
      )}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function startNewMemory() {
    clearAudio();

    setOrderNumber("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");

    setSender("");
    setRecipient("");
    setMessage("");

    setCreationMode("STAFF");

    setError("");
    setSaving(false);
    setRecordingBusy(false);
    setSavedMemory(null);

    setCustomerUploadUrl("");
    setCopied(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="text-xl font-bold tracking-widest text-emerald-900">
            MEMORY BLOCK
          </span>

          <span className="text-sm text-slate-500">
            Staff workspace
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Create a memory
        </h1>

        <p className="mt-3 text-slate-600">
          Create the order and either add
          the voice message now or let the
          customer upload it from their phone.
        </p>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
          {/* LEFT */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <form
              onSubmit={handleSave}
              aria-busy={saving}
            >
              {/* ORDER DETAILS */}
              <fieldset
                disabled={locked}
                className="min-w-0"
              >
                <legend className="text-xl font-semibold">
                  Order details
                </legend>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Order number

                    <input
                      type="text"
                      required
                      value={orderNumber}
                      onChange={(event) =>
                        setOrderNumber(
                          event.target.value
                        )
                      }
                      placeholder="e.g. ILF-1058"
                      maxLength={80}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium">
                    Customer name

                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(event) =>
                        setCustomerName(
                          event.target.value
                        )
                      }
                      placeholder="Customer name"
                      maxLength={80}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Email

                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(event) =>
                        setCustomerEmail(
                          event.target.value
                        )
                      }
                      placeholder="customer@email.com"
                      maxLength={254}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium">
                    Mobile

                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(event) =>
                        setCustomerPhone(
                          event.target.value
                        )
                      }
                      placeholder="07700 123456"
                      maxLength={30}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </label>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Email or mobile is required
                  if the customer will upload
                  later.
                </p>
              </fieldset>

              {/* MEMORY DETAILS */}
              <fieldset
                disabled={locked}
                className="mt-8 min-w-0 border-t border-slate-200 pt-8"
              >
                <legend className="text-xl font-semibold">
                  Memory details
                </legend>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    From

                    <input
                      type="text"
                      required
                      value={sender}
                      onChange={(event) =>
                        setSender(
                          event.target.value
                        )
                      }
                      placeholder="Sender’s name"
                      maxLength={80}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium">
                    For

                    <input
                      type="text"
                      required
                      value={recipient}
                      onChange={(event) =>
                        setRecipient(
                          event.target.value
                        )
                      }
                      placeholder="Recipient’s name"
                      maxLength={80}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </label>
                </div>

                <label className="mt-6 grid gap-2 text-sm font-medium">
                  Short message — optional

                  <textarea
                    value={message}
                    onChange={(event) =>
                      setMessage(
                        event.target.value
                      )
                    }
                    placeholder="A little message, made just for you."
                    maxLength={500}
                    rows={3}
                    className="resize-y rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                  />

                  <span className="text-right text-xs font-normal text-slate-400">
                    {message.length}/500
                  </span>
                </label>
              </fieldset>

              {/* METHOD */}
              {!savedMemory && (
                <fieldset
                  disabled={saving}
                  className="mt-8 border-t border-slate-200 pt-8"
                >
                  <legend className="text-lg font-semibold">
                    How will the voice message be added?
                  </legend>

                  <div className="mt-5 grid gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        changeCreationMode(
                          "STAFF"
                        )
                      }
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        creationMode === "STAFF"
                          ? "border-emerald-900 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            creationMode ===
                            "STAFF"
                              ? "border-emerald-900"
                              : "border-slate-300"
                          }`}
                        >
                          {creationMode ===
                            "STAFF" && (
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-900" />
                          )}
                        </div>

                        <div>
                          <p className="font-semibold">
                            Add recording now
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Staff records or
                            uploads the customer&apos;s
                            voice message.
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        changeCreationMode(
                          "CUSTOMER"
                        )
                      }
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        creationMode ===
                        "CUSTOMER"
                          ? "border-emerald-900 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            creationMode ===
                            "CUSTOMER"
                              ? "border-emerald-900"
                              : "border-slate-300"
                          }`}
                        >
                          {creationMode ===
                            "CUSTOMER" && (
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-900" />
                          )}
                        </div>

                        <div>
                          <p className="font-semibold">
                            Customer uploads later
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Generate a private
                            link for the customer
                            to use on their phone.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </fieldset>
              )}

              {/* STAFF AUDIO */}
              {!savedMemory &&
                creationMode === "STAFF" && (
                  <>
                    <fieldset
                      disabled={
                        locked ||
                        recordingBusy
                      }
                      className="mt-6 min-w-0"
                    >
                      <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-5">
                        <label
                          htmlFor="voice-note"
                          className="block font-semibold text-emerald-950"
                        >
                          Upload a voice note
                        </label>

                        <p className="mt-2 text-sm text-slate-600">
                          MP3, M4A, WAV, OGG,
                          OPUS or WebM · up to
                          25 MB
                        </p>

                        <input
                          id="voice-note"
                          type="file"
                          accept=".mp3,.m4a,.wav,.ogg,.opus,.webm,audio/*"
                          onChange={(
                            event
                          ) => {
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
                        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                              Voice note ready
                            </p>

                            <p className="mt-1 truncate text-sm font-medium">
                              {
                                audioFile.name
                              }
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
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
                            onClick={() => {
                              clearAudio();
                              setError("");
                            }}
                            className="text-sm font-medium text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </fieldset>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />

                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Or
                        </span>

                        <div className="h-px flex-1 bg-slate-200" />
                      </div>

                      <VoiceRecorder
                        disabled={locked}
                        onRecorded={
                          selectAudio
                        }
                        onBusyChange={
                          setRecordingBusy
                        }
                      />
                    </div>
                  </>
                )}

              {/* ERROR */}
              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              {/* SUCCESS */}
              {savedMemory ? (
                <div className="mt-7">
                  {savedMemory.status ===
                  "READY" ? (
                    <>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                        <p className="font-semibold">
                          ✓ Memory saved
                          successfully
                        </p>

                        <p className="mt-2 text-sm">
                          The voice message is
                          ready and the QR code
                          can now be printed.
                        </p>
                      </div>

                      <MemoryQr
                        publicCode={
                          savedMemory.publicCode
                        }
                        recipientName={
                          recipient
                        }
                      />
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-amber-500" />

                          <div>
                            <p className="font-semibold text-amber-950">
                              Waiting for customer
                              upload
                            </p>

                            <p className="mt-2 text-sm leading-6 text-amber-800">
                              Order{" "}
                              <strong>
                                {orderNumber}
                              </strong>{" "}
                              has been created.
                              Send the private
                              link below to the
                              customer.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl border border-slate-200 p-5">
                        <p className="text-sm font-semibold text-slate-900">
                          Private customer
                          upload link
                        </p>

                        <div className="mt-3 rounded-lg bg-slate-50 p-3">
                          <p className="break-all text-xs leading-5 text-slate-600">
                            {
                              customerUploadUrl
                            }
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={
                              copyUploadLink
                            }
                            className="rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
                          >
                            {copied
                              ? "Copied ✓"
                              : "Copy link"}
                          </button>

                          <button
                            type="button"
                            onClick={
                              openWhatsApp
                            }
                            className="rounded-lg bg-emerald-900 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
                          >
                            Open WhatsApp
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                        <p className="font-semibold text-slate-700">
                          QR code pending
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          The QR code will become
                          available once the
                          customer submits their
                          voice message.
                        </p>
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={startNewMemory}
                    className="mt-5 w-full rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
                  >
                    Create another memory
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={
                    saving ||
                    recordingBusy ||
                    (creationMode ===
                      "STAFF" &&
                      !audioFile)
                  }
                  className="mt-7 w-full rounded-lg bg-emerald-900 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Creating…"
                    : creationMode ===
                        "CUSTOMER"
                      ? "Create order & upload link"
                      : "Save memory"}
                </button>
              )}
            </form>
          </section>

          {/* RIGHT SIDE */}
          <section className="rounded-2xl bg-emerald-950 p-6 text-center text-white shadow-lg sm:p-10">
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-200">
              Recipient preview
            </p>

            <p className="mt-12 text-emerald-100">
              A special voice memory for
            </p>

            <h2 className="mt-3 break-words font-serif text-4xl sm:text-5xl">
              {recipient.trim() ||
                "Someone special"}
            </h2>

            <p className="mt-6 whitespace-pre-wrap break-words text-lg leading-8 text-emerald-50">
              {message.trim() ||
                "A little message, made just for you."}
            </p>

            <div className="mt-10 rounded-xl bg-white p-4 text-slate-900">
              {creationMode ===
              "CUSTOMER" ? (
                <div className="py-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl">
                    ⏳
                  </div>

                  <p className="mt-3 font-medium">
                    Waiting for customer
                    recording
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Their voice message will
                    appear once they submit it.
                  </p>
                </div>
              ) : audioUrl ? (
                <>
                  <p className="mb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Voice message
                  </p>

                  <audio
                    key={audioUrl}
                    controls
                    preload="metadata"
                    src={audioUrl}
                    className="w-full"
                  >
                    Your browser does not
                    support audio playback.
                  </audio>
                </>
              ) : (
                <div className="py-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl">
                    🎙️
                  </div>

                  <p className="mt-3 text-sm text-slate-500">
                    Upload or record a voice
                    note to preview it here.
                  </p>
                </div>
              )}
            </div>

            <p className="mb-6 mt-10 break-words text-emerald-100">
              From{" "}
              <strong className="text-white">
                {sender.trim() ||
                  "Someone who cares"}
              </strong>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}