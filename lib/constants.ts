export const MAX_AUDIO_FILE_SIZE =
  25 * 1024 * 1024;

export const VOICE_NOTES_BUCKET =
  "voice-notes";

export const PRODUCTION_APP_URL =
  "https://memoryblockapp.vercel.app";

export const SUPPORTED_AUDIO_EXTENSIONS = [
  "mp3",
  "m4a",
  "mp4",
  "wav",
  "ogg",
  "opus",
  "webm",
] as const;

export const QR_BATCH_SIZES = [
  20,
  50,
  100,
] as const;
