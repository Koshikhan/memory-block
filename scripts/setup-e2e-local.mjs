import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
  path: ".env.test.local",
  quiet: true,
});

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const secretKey =
  process.env.SUPABASE_SECRET_KEY;

const email =
  process.env.TEST_STAFF_EMAIL;

const password =
  process.env.TEST_STAFF_PASSWORD;

if (
  !url ||
  !secretKey ||
  !email ||
  !password
) {
  throw new Error(
    "Missing local E2E environment variables."
  );
}

if (
  !url.includes("127.0.0.1") &&
  !url.includes("localhost")
) {
  throw new Error(
    `Refusing to run against non-local Supabase: ${url}`
  );
}

const supabase = createClient(
  url,
  secretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const {
  data: existingUsers,
  error: listError,
} =
  await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

if (listError) {
  throw listError;
}

let user =
  existingUsers.users.find(
    (item) => item.email === email
  );

if (!user) {
  const {
    data,
    error,
  } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (error) {
    throw error;
  }

  user = data.user;

  console.log(
    `Created local test user: ${email}`
  );
} else {
  console.log(
    `Local test user already exists: ${email}`
  );
}

const {
  error: staffError,
} =
  await supabase
    .from("staff_members")
    .upsert({
      user_id: user.id,
    });

if (staffError) {
  throw staffError;
}

console.log(
  "Ensured staff_members access."
);

const {
  data: bucket,
} =
  await supabase.storage.getBucket(
    "voice-notes"
  );

if (!bucket) {
  const {
    error: bucketError,
  } =
    await supabase.storage.createBucket(
      "voice-notes",
      {
        public: false,
        fileSizeLimit:
          25 * 1024 * 1024,
        allowedMimeTypes: [
          "audio/mpeg",
          "audio/mp4",
          "audio/x-m4a",
          "audio/wav",
          "audio/x-wav",
          "audio/ogg",
          "audio/opus",
          "audio/webm",
        ],
      }
    );

  if (bucketError) {
    throw bucketError;
  }

  console.log(
    "Created local voice-notes bucket."
  );
} else {
  console.log(
    "Local voice-notes bucket already exists."
  );
}

const envPath =
  ".env.test.local";

let envText =
  fs.readFileSync(
    envPath,
    "utf8"
  );

function setEnvValue(
  text,
  key,
  value
) {
  const line =
    `${key}=${value}`;

  const pattern =
    new RegExp(
      `^${key}=.*$`,
      "m"
    );

  if (pattern.test(text)) {
    return text.replace(
      pattern,
      line
    );
  }

  return (
    text.trimEnd() +
    `\n${line}\n`
  );
}

envText =
  setEnvValue(
    envText,
    "TEST_STAFF_USER_ID",
    user.id
  );

envText =
  setEnvValue(
    envText,
    "SHOP_OWNER_USER_ID",
    user.id
  );

fs.writeFileSync(
  envPath,
  envText
);

console.log(
  "Updated local test environment with staff user ID."
);

console.log(
  "Local E2E Supabase setup complete."
);
