import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { shares } from "@/lib/db/schema/shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function sharingDisabledResponse() {
  return NextResponse.json(
    {
      error:
        "Sharing is disabled. Set DATABASE_URL and create the `shares` table to enable it.",
    },
    { status: 501 },
  );
}

function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  // Postgres: undefined_table
  if (code === "42P01") return true;
  const message = (err as { message?: unknown })?.message;
  return typeof message === "string" && message.toLowerCase().includes("relation") && message.toLowerCase().includes("shares");
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return sharingDisabledResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const input = normalizeString((body as { input?: unknown })?.input);
  const prompt = normalizeString((body as { prompt?: unknown })?.prompt);
  const voice = normalizeString((body as { voice?: unknown })?.voice);

  if (!input) return badRequest("Missing input");
  if (!prompt) return badRequest("Missing prompt");
  if (!voice) return badRequest("Missing voice");

  if (input.length > 5000) return badRequest("Input too long");
  if (prompt.length > 5000) return badRequest("Prompt too long");
  if (voice.length > 64) return badRequest("Voice too long");

  const id = nanoid(10);

  try {
    await db.insert(shares).values({
      id,
      input,
      prompt,
      voice,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      return sharingDisabledResponse();
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to store share link" }, { status: 500 });
  }

  return NextResponse.json({ id });
}

export async function GET(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return sharingDisabledResponse();
  }

  const hash = normalizeString(req.nextUrl.searchParams.get("hash"));
  if (!hash) return badRequest("Missing hash");

  let row: Array<{ input: string; prompt: string; voice: string }>;
  try {
    row = await db
      .select({ input: shares.input, prompt: shares.prompt, voice: shares.voice })
      .from(shares)
      .where(eq(shares.id, hash))
      .limit(1);
  } catch (err) {
    if (isMissingTableError(err)) {
      return sharingDisabledResponse();
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to load share link" }, { status: 500 });
  }

  const found = row[0];
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(found);
}
