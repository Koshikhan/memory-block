type Props = {
    uploadUrl: string;
    copied: boolean;
    onCopy: () => void;
    onOpenWhatsApp: () => void;
  };
  
  export default function CustomerUploadCard({
    uploadUrl,
    copied,
    onCopy,
    onOpenWhatsApp,
  }: Props) {
    return (
      <div className="rounded-xl border border-amber-200 bg-white p-6">
        <h2 className="text-lg font-semibold">
          Customer upload
        </h2>
  
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The customer has not submitted their recording yet.
        </p>
  
        <div className="mt-5 rounded-lg bg-slate-50 p-4">
          <p className="break-all text-xs text-slate-600">
            {uploadUrl}
          </p>
        </div>
  
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-emerald-900 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            {copied
              ? "Copied ✓"
              : "Copy upload link"}
          </button>
  
          <button
            type="button"
            onClick={onOpenWhatsApp}
            className="rounded-lg bg-emerald-950 px-4 py-3 font-semibold text-white hover:bg-emerald-900"
          >
            Open WhatsApp
          </button>
        </div>
      </div>
    );
  }
  