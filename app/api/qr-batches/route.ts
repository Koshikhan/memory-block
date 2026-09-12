import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_QUANTITIES = new Set([20, 50, 100]);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

function createQrCode() {
  let code = "";

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }

  return code;
}

function createUniqueCodes(quantity: number) {
  const codes = new Set<string>();

  while (codes.size < quantity) {
    codes.add(createQrCode());
  }

  return Array.from(codes);
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in to generate QR codes." },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const quantity = Number(body?.quantity);

    if (!ALLOWED_QUANTITIES.has(quantity)) {
      return NextResponse.json(
        { error: "Quantity must be 20, 50, or 100." },
        { status: 400 }
      );
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("qr_batches")
      .insert({
        created_by: user.id,
        requested_quantity: quantity,
      })
      .select("id,batch_number,requested_quantity,created_at")
      .single();

    if (batchError || !batch) {
      console.error("QR batch creation failed:", batchError);

      return NextResponse.json(
        { error: "Unable to create the QR batch." },
        { status: 500 }
      );
    }

    const codes = createUniqueCodes(quantity);

    const qrRows = codes.map((code) => ({
      batch_id: batch.id,
      code,
      created_by: user.id,
      status: "AVAILABLE",
    }));

    const { data: createdCodes, error: codesError } = await supabaseAdmin
      .from("qr_codes")
      .insert(qrRows)
      .select("id,code,status,created_at");

    if (codesError || !createdCodes) {
      console.error("QR code creation failed:", codesError);

      await supabaseAdmin
        .from("qr_batches")
        .delete()
        .eq("id", batch.id)
        .eq("created_by", user.id);

      return NextResponse.json(
        { error: "Unable to generate the QR codes." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        batch: {
          ...batch,
          available_count: createdCodes.length,
        },
        codes: createdCodes,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected QR batch error:", error);

    return NextResponse.json(
      { error: "Unexpected error while generating QR codes." },
      { status: 500 }
    );
  }
}
