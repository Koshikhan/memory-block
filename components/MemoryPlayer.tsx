"use client";

import { useState } from "react";

type Props = {
  src: string;
};

export default function MemoryPlayer({ src }: Props) {
  const [error, setError] = useState("");

  return (
    <div className="w-full">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7 text-emerald-950"
          aria-hidden="true"
        >
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
          <path d="M8 21h8" />
        </svg>
      </div>

      <p className="mt-4 text-center text-sm font-medium text-slate-700">
        Tap play to hear your memory
      </p>

      <audio
        controls
        preload="metadata"
        playsInline
        src={src}
        onError={() => {
          setError(
            "This voice memory could not be played on this device."
          );
        }}
        className="mt-6 w-full"
      >
        Your browser does not support audio playback.
      </audio>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}