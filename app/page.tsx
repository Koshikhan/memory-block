"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  createMemory,
  createPendingMemory,
} from "@/lib/memories";

import { createClient } from "@/lib/supabase/client";
import { validateAudioFile } from "@/lib/audio";
import type { CreationMode } from "@/types/memory";

import StaffHeader from "@/components/layout/StaffHeader";
import PremadeQrPanel from "@/components/memory/PremadeQrPanel";
import RecipientPreview from "@/components/memory/RecipientPreview";
import OrderDetailsFields from "@/components/memory/OrderDetailsFields";
import MemoryDetailsFields from "@/components/memory/MemoryDetailsFields";
import CreationMethodSelector from "@/components/memory/CreationMethodSelector";
import StaffAudioInput from "@/components/memory/StaffAudioInput";
import MemoryCreationResult from "@/components/memory/MemoryCreationResult";


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

    const validationError =
      validateAudioFile(file);

    if (validationError) {
      setError(validationError);
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

              <MemoryCreationResult
                savedMemory={savedMemory}
                customerUploadReady={customerUploadReady}
                orderNumber={orderNumber}
                recipient={recipient}
                customerUploadUrl={customerUploadUrl}
                copied={copied}
                saving={saving}
                recordingBusy={recordingBusy}
                creationMode={creationMode}
                audioFile={audioFile}
                onCopyUploadLink={copyUploadLink}
                onOpenWhatsApp={openWhatsApp}
                onStartNewMemory={startNewMemory}
              />

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