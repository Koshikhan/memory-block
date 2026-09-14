import type { CreationMode } from "@/types/memory";

type Props = {
  creationMode: CreationMode;
  disabled?: boolean;
  onChange: (mode: CreationMode) => void;
};

export default function CreationMethodSelector({
  creationMode,
  disabled = false,
  onChange,
}: Props) {
  return (
    <fieldset
      disabled={disabled}
      className="mt-8 border-t border-slate-200 pt-8"
    >
      <legend className="text-lg font-semibold">
        How will the voice message be added?
      </legend>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          onClick={() => onChange("STAFF")}
          className={`rounded-xl border-2 p-4 text-left transition ${
            creationMode === "STAFF"
              ? "border-emerald-900 bg-emerald-50"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex gap-3">
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                creationMode === "STAFF"
                  ? "border-emerald-900"
                  : "border-slate-300"
              }`}
            >
              {creationMode === "STAFF" && (
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-900" />
              )}
            </div>

            <div>
              <p className="font-semibold">
                Add recording now
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Staff records or uploads the customer&apos;s voice message.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange("CUSTOMER")}
          className={`rounded-xl border-2 p-4 text-left transition ${
            creationMode === "CUSTOMER"
              ? "border-emerald-900 bg-emerald-50"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex gap-3">
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                creationMode === "CUSTOMER"
                  ? "border-emerald-900"
                  : "border-slate-300"
              }`}
            >
              {creationMode === "CUSTOMER" && (
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-900" />
              )}
            </div>

            <div>
              <p className="font-semibold">
                Customer uploads later
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Generate a private link for the customer to use on their phone.
              </p>
            </div>
          </div>
        </button>
      </div>
    </fieldset>
  );
}
