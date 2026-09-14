type RecipientPreviewProps = {
    recipient: string;
    message: string;
    sender: string;
    creationMode: "STAFF" | "CUSTOMER";
    customerUploadReady: boolean;
    audioUrl: string;
  };
  
  export default function RecipientPreview({
    recipient,
    message,
    sender,
    creationMode,
    customerUploadReady,
    audioUrl,
  }: RecipientPreviewProps) {
    return (
      <section className="rounded-2xl bg-emerald-950 p-6 text-center text-white shadow-lg sm:p-10">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-200">
          Recipient preview
        </p>
  
        <p className="mt-12 text-emerald-100">
          A special voice memory for
        </p>
  
        <h2 className="mt-3 break-words font-serif text-4xl sm:text-5xl">
          {recipient.trim() || "Someone special"}
        </h2>
  
        <p className="mt-6 whitespace-pre-wrap break-words text-lg leading-8 text-emerald-50">
          {message.trim() || "A little message, made just for you."}
        </p>
  
        <div className="mt-10 rounded-xl bg-white p-4 text-slate-900">
          {creationMode === "CUSTOMER" ? (
            customerUploadReady ? (
              <div className="py-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl">
                  ✓
                </div>
  
                <p className="mt-3 font-medium">
                  Customer recording received
                </p>
  
                <p className="mt-2 text-sm text-slate-500">
                  The QR code is now ready to print.
                </p>
              </div>
            ) : (
              <div className="py-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl">
                  ⏳
                </div>
  
                <p className="mt-3 font-medium">
                  Waiting for customer recording
                </p>
  
                <p className="mt-2 text-sm text-slate-500">
                  Their voice message will appear once they submit it.
                </p>
              </div>
            )
          ) : audioUrl ? (
            <>
              <p className="mb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Voice message
              </p>
  
              <audio
                key={audioUrl}
                controls
                preload="metadata"
                playsInline
                src={audioUrl}
                className="w-full"
              >
                Your browser does not support audio playback.
              </audio>
            </>
          ) : (
            <div className="py-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl">
                🎙️
              </div>
  
              <p className="mt-3 text-sm text-slate-500">
                Upload or record a voice note to preview it here.
              </p>
            </div>
          )}
        </div>
  
        <p className="mb-6 mt-10 break-words text-emerald-100">
          From{" "}
          <strong className="text-white">
            {sender.trim() || "Someone who cares"}
          </strong>
        </p>
      </section>
    );
  }
  