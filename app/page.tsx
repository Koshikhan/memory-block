"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  createMemory,
  createPendingMemory,
} from "@/lib/memories";

import { createClient } from "@/lib/supabase/client";
import { MAX_AUDIO_FILE_SIZE } from "@/lib/constants";
import type { CreationMode } from "@/types/memory";

import MemoryQr from "@/components/MemoryQr";
import StaffHeader from "@/components/layout/StaffHeader";
import PremadeQrPanel from "@/components/memory/PremadeQrPanel";
import RecipientPreview from "@/components/memory/RecipientPreview";
import OrderDetailsFields from "@/components/memory/OrderDetailsFields";
import MemoryDetailsFields from "@/components/memory/MemoryDetailsFields";
import CreationMethodSelector from "@/components/memory/CreationMethodSelector";
import StaffAudioInput from "@/components/memory/StaffAudioInput";


type StaffMemory = Awaited<ReturnType<typeof createMemory>>;

type PendingMemory = Awaited<
  ReturnType<typeof createPendingMemory>
>;

type SavedMemory = StaffMemory | PendingMemory;

export default function Home() {
  // Order details
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Memory details
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");

  // Creation mode
  const [creationMode, setCreationMode] =
    useState<CreationMode>("STAFF");

  // Audio
  const [audioFile, setAudioFile] =
    useState<File | null>(null);

  const [audioUrl, setAudioUrl] = useState("");

  // UI state
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [recordingBusy, setRecordingBusy] =
    useState(false);

  const [savedMemory, setSavedMemory] =
    useState<SavedMemory | null>(null);

  const [customerUploadUrl, setCustomerUploadUrl] =
    useState("");

  const [copied, setCopied] = useState(false);

  const [customerUploadReady, setCustomerUploadReady] =
    useState(false);

  const [uploadNotification, setUploadNotification] =
    useState("");

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

  useEffect(() => {
    if (
      !savedMemory ||
      savedMemory.status !== "WAITING_FOR_UPLOAD" ||
      customerUploadReady
    ) {
      return;
    }

    const supabase = createClient();

    const markReady = () => {
      setCustomerUploadReady(true);
      setUploadNotification(
        "✓ Customer voice message received. The QR code is now ready."
      );
    };

    const channel = supabase
      .channel(`memory-upload-${savedMemory.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "memories",
          filter: `id=eq.${savedMemory.id}`,
        },
        (payload) => {
          const updatedMemory = payload.new as {
            status?: string;
            audio_path?: string | null;
          };

          if (
            updatedMemory.status === "READY" &&
            updatedMemory.audio_path
          ) {
            markReady();
          }
        }
      )
      .subscribe();

    const interval = window.setInterval(async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("status, audio_path")
        .eq("id", savedMemory.id)
        .maybeSingle();

      if (
        !error &&
        data?.status === "READY" &&
        data.audio_path
      ) {
        markReady();
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [savedMemory, customerUploadReady]);

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
    if (!file || locked) {
      return;
    }

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

    if (
      file.size > MAX_AUDIO_FILE_SIZE
    ) {
      setError(
        "Please choose a recording up to 25 MB."
      );

      return;
    }

    clearAudio();

    const url =
      URL.createObjectURL(file);

    previewUrlRef.current = url;

    setAudioFile(file);
    setAudioUrl(url);
  }

  function changeCreationMode(
    mode: CreationMode
  ) {
    if (locked) {
      return;
    }

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

      // Staff uploads / records now
      if (creationMode === "STAFF") {
        if (!audioFile) {
          throw new Error(
            "Please upload or record a voice note first."
          );
        }

        const memory =
          await createMemory({
            ...commonDetails,
            audioFile,
          });

        setSavedMemory(memory);
      }

      // Customer uploads later
      else {
        const memory =
          await createPendingMemory(
            commonDetails
          );

        setSavedMemory(memory);

        const baseUrl =
          getBaseUrl();

        const uploadUrl =
          `${baseUrl}/upload/${memory.uploadToken}`;

        setCustomerUploadUrl(
          uploadUrl
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
    if (!customerUploadUrl) {
      return;
    }

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
    if (!customerUploadUrl) {
      return;
    }

    const text = [
      `Hi ${customerName.trim() || "there"},`,
      "",
      `Please add your voice message for ${
        recipient.trim() ||
        "your Memory Block"
      }.`,
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

    setCustomerUploadReady(false);
    setUploadNotification("");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <StaffHeader
        current="home"
        maxWidth="6xl"
      />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Create a memory
        </h1>

        <p className="mt-3 text-slate-600">
          Create the order and either add the voice
          message now or let the customer upload it
          from their phone.
        </p>

        <PremadeQrPanel />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
          {/* LEFT SIDE */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <form
              onSubmit={handleSave}
              aria-busy={saving}
            >
              <OrderDetailsFields
                locked={locked}
                orderNumber={orderNumber}
                customerName={customerName}
                customerEmail={customerEmail}
                customerPhone={customerPhone}
                onOrderNumberChange={setOrderNumber}
                onCustomerNameChange={setCustomerName}
                onCustomerEmailChange={setCustomerEmail}
                onCustomerPhoneChange={setCustomerPhone}
              />

              <MemoryDetailsFields
                locked={locked}
                sender={sender}
                recipient={recipient}
                message={message}
                onSenderChange={setSender}
                onRecipientChange={setRecipient}
                onMessageChange={setMessage}
              />

              {!savedMemory && (
                <CreationMethodSelector
                  creationMode={creationMode}
                  disabled={saving}
                  onChange={changeCreationMode}
                />
              )}

              {!savedMemory &&
                creationMode === "STAFF" && (
                  <StaffAudioInput
                    locked={locked}
                    recordingBusy={recordingBusy}
                    audioFile={audioFile}
                    onSelectAudio={selectAudio}
                    onRemoveAudio={() => {
                      clearAudio();
                      setError("");
                    }}
                    onBusyChange={setRecordingBusy}
                  />
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

              {/* CUSTOMER UPLOAD NOTIFICATION */}
              {uploadNotification && (
                <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
                  <p className="font-semibold">
                    {uploadNotification}
                  </p>
                </div>
              )}

              {/* SUCCESS */}
              {savedMemory ? (
                <div className="mt-7">
                  {savedMemory.status === "READY" ||
                  customerUploadReady ? (
                    <>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                        <p className="font-semibold">
                          {customerUploadReady
                            ? "✓ Customer voice message received"
                            : "✓ Memory saved successfully"}
                        </p>

                        <p className="mt-2 text-sm">
                          {customerUploadReady
                            ? "The customer recording has arrived and the QR code is now available."
                            : "The voice message is ready and the QR code can now be printed."}
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
                              Waiting for customer upload
                            </p>

                            <p className="mt-2 text-sm leading-6 text-amber-800">
                              Order{" "}
                              <strong>
                                {orderNumber}
                              </strong>{" "}
                              has been created. Send the
                              private link below to the
                              customer.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Upload link */}
                      <div className="mt-5 rounded-xl border border-slate-200 p-5">
                        <p className="text-sm font-semibold text-slate-900">
                          Private customer upload link
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

                      {/* QR locked */}
                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                          ⏳
                        </div>

                        <p className="mt-3 font-semibold text-slate-700">
                          QR code pending
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          The QR code will become available
                          once the customer submits their
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
                    (
                      creationMode ===
                        "STAFF" &&
                      !audioFile
                    )
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

          <RecipientPreview
            recipient={recipient}
            message={message}
            sender={sender}
            creationMode={creationMode}
            customerUploadReady={customerUploadReady}
            audioUrl={audioUrl}
          />
        </div>
      </div>
    </main>
  );
}