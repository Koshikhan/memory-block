import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const secret =
  process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error(
    "Missing local Supabase E2E environment variables."
  );
}

if (
  !url.includes("127.0.0.1") &&
  !url.includes("localhost")
) {
  throw new Error(
    `E2E SAFETY CHECK FAILED: ${url}`
  );
}

export const localSupabaseAdmin =
  createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
