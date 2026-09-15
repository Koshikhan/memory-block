import VoiceRecorder from "@/components/VoiceRecorder";

type Props = {
  locked: boolean;
  recordingBusy: boolean;
  audioFile: File | null;
  onSelectAudio: (file: File | undefined) => void;
  onRecordedAudio: (file: File | undefined) => void;
  onRemoveAudio: () => void;
  onBusyChange: (busy: boolean) => void;
};

export default function StaffAudioInput({
  locked,
  recordingBusy,
  audioFile,
  onSelectAudio,
  onRecordedAudio,
  onRemoveAudio,
  onBusyChange,
}: Props) {
  return (
    <>
      <fieldset
        disabled={locked || recordingBusy}
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
            MP3 only · up to 25 MB
          </p>

          <input
            id="voice-note"
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={(event) => {
              onSelectAudio(event.target.files?.[0]);
              event.target.value = "";
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
                {audioFile.name}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {(audioFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <button
              type="button"
              onClick={onRemoveAudio}
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
          onRecorded={onRecordedAudio}
          onBusyChange={onBusyChange}
        />
      </div>
    </>
  );
}
