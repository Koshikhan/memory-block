import { MAX_AUDIO_FILE_SIZE } from "@/lib/constants";

const AUDIO_FILE_PATTERN = /\.mp3$/i;

export function validateAudioFile(
  file: File
): string | null {
  if (!AUDIO_FILE_PATTERN.test(file.name)) {
    return "Please choose an MP3 file.";
  }

  if (file.size === 0) {
    return "This file is empty. Please choose another recording.";
  }

  if (file.size > MAX_AUDIO_FILE_SIZE) {
    return "Please choose a recording up to 25 MB.";
  }

  return null;
}
