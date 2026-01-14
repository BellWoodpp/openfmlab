import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { desc, eq, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { voiceClones, voiceCloneSamples } from "@/lib/db/schema/voiceClones";
import { checkUserPaidMembership } from "@/lib/membership";
import { isVoiceCloningEnabled } from "@/lib/voice-cloning-enabled";
import { isR2Configured, r2DeleteObjects, r2PutObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

const MAX_CLONES_PER_USER = Math.max(1, Math.min(10_000, envInt("VOICE_CLONE_MAX_PER_USER", 1000)));

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isMissingRelationError(err: unknown, relation: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  const relationName = (err as { relation?: unknown }).relation;
  if (relationName === relation) return true;
  if (code === "42P01") return typeof message === "string" && message.includes(relation);
  return typeof message === "string" && message.includes(`relation "${relation}" does not exist`);
}

function isMissingColumnError(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  if (code === "42703") {
    return typeof message === "string" && message.toLowerCase().includes(column.toLowerCase());
  }
  return typeof message === "string" && message.includes(`column "${column}" does not exist`);
}

function isNotNullViolation(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  if (code === "23502") return typeof message === "string" ? message.includes(column) : true;
  return typeof message === "string" && message.toLowerCase().includes("null value") && message.includes(column);
}

function extFromMimeType(mimeType: string): string {
  const t = (mimeType || "").toLowerCase();
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("webm")) return "webm";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "bin";
}

async function requireUserId(req: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const session = await auth.api.getSession({ headers: req.headers });
  const email = session?.user?.email;
  if (!email) return false;
  const list = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) ?? [];
  return list.includes(email);
}

async function countUserClones(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(voiceClones)
    .where(eq(voiceClones.userId, userId));
  return row?.count ?? 0;
}

export async function GET(req: NextRequest) {
  if (!isVoiceCloningEnabled()) {
    return NextResponse.json({ error: "Voice cloning is currently disabled." }, { status: 501 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Set DATABASE_URL and run migrations to enable voice cloning." },
      { status: 501 },
    );
  }

  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "no auth, please sign-in" }, { status: 401 });

  const admin = await isAdmin(req);
  if (!admin) {
    const membership = await checkUserPaidMembership(userId);
    if (!membership.isPaid) {
      if (membership.reason === "orders_table_missing") {
        return NextResponse.json(
          { error: "Orders table is missing. Run `pnpm db:push` to apply migrations." },
          { status: 501 },
        );
      }
      return NextResponse.json(
        { error: "PREMIUM_REQUIRED", message: "Voice cloning is available to paid members only." },
        { status: 402 },
      );
    }
  }

  try {
    const clones = await db
      .select({
        id: voiceClones.id,
        name: voiceClones.name,
        status: voiceClones.status,
        provider: voiceClones.provider,
        languageCode: voiceClones.languageCode,
        modelName: voiceClones.modelName,
        isDefault: voiceClones.isDefault,
        createdAt: voiceClones.createdAt,
        updatedAt: voiceClones.updatedAt,
      })
      .from(voiceClones)
      .where(eq(voiceClones.userId, userId))
      .orderBy(desc(voiceClones.createdAt));

    return NextResponse.json({
      maxClones: MAX_CLONES_PER_USER,
      clones: clones.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    if (isMissingRelationError(err, "voice_clones")) {
      return NextResponse.json(
        { error: "Voice cloning database tables are missing. Run `pnpm db:push` to apply migrations." },
        { status: 501 },
      );
    }
    if (isMissingColumnError(err, "language_code") || isMissingColumnError(err, "model_name")) {
      return NextResponse.json(
        { error: "Voice cloning database schema is outdated. Run `pnpm db:push` to apply migrations." },
        { status: 501 },
      );
    }

    console.error(err);
    return NextResponse.json(
      { error: "Failed to load voice clones (server error). Check server logs." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isVoiceCloningEnabled()) {
    return NextResponse.json({ error: "Voice cloning is currently disabled." }, { status: 501 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Set DATABASE_URL and run migrations to enable voice cloning." },
      { status: 501 },
    );
  }

  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "no auth, please sign-in" }, { status: 401 });

  const admin = await isAdmin(req);
  if (!admin) {
    const membership = await checkUserPaidMembership(userId);
    if (!membership.isPaid) {
      if (membership.reason === "orders_table_missing") {
        return NextResponse.json(
          { error: "Orders table is missing. Run `pnpm db:push` to apply migrations." },
          { status: 501 },
        );
      }
      return NextResponse.json(
        { error: "PREMIUM_REQUIRED", message: "Voice cloning is available to paid members only." },
        { status: 402 },
      );
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const rawName = normalizeString(form.get("name"));
  const name = rawName.slice(0, 40);
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const languageCode = normalizeString(form.get("languageCode")) || "en-US";
  if (languageCode.length > 32) return NextResponse.json({ error: "languageCode too long" }, { status: 400 });

  const modelNameRaw = normalizeString(form.get("modelName"));
  const modelName = modelNameRaw ? modelNameRaw.slice(0, 200) : null;

  // Platform-hosted: users upload audio samples; key binding is handled by admins later.
  const samples = form.getAll("samples");
  const files = samples.filter((v): v is File => v instanceof File);
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

  const voiceCloningKey = admin ? normalizeString(form.get("voiceCloningKey")).slice(0, 2048) : "";

  if (!admin) {
    if (files.length === 0) {
      return NextResponse.json({ error: "Please upload or record at least one audio sample." }, { status: 400 });
    }
  }

  let totalBytes = 0;
  for (const f of files) {
    totalBytes += f.size;
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `Sample too large: ${f.name} (max 10MB per file)` }, { status: 400 });
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "Total samples too large (max 20MB)" }, { status: 400 });
    }
  }

  const existingCount = await countUserClones(userId);
  if (existingCount >= MAX_CLONES_PER_USER) {
    return NextResponse.json(
      { error: `Voice clone limit reached (${MAX_CLONES_PER_USER}). Delete one to create a new clone.` },
      { status: 409 },
    );
  }

  const id = nanoid(12);
  const now = new Date();

  try {
    const [inserted] = await db
      .insert(voiceClones)
      .values({
        id,
        userId,
        provider: "google",
        providerVoiceId: voiceCloningKey || null,
        languageCode,
        modelName,
        name,
        status: admin && voiceCloningKey ? "ready" : "pending",
        isDefault: existingCount === 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: voiceClones.id,
        name: voiceClones.name,
        status: voiceClones.status,
        provider: voiceClones.provider,
        languageCode: voiceClones.languageCode,
        modelName: voiceClones.modelName,
        isDefault: voiceClones.isDefault,
        createdAt: voiceClones.createdAt,
        updatedAt: voiceClones.updatedAt,
      });

    // Store sample audio for review/processing (platform-hosted).
    if (files.length > 0) {
      const drafts: Array<{
        sampleId: string;
        filename: string;
        mimeType: string;
        audio: Buffer;
        r2Key: string | null;
      }> = [];

      for (const f of files) {
        const ab = await f.arrayBuffer();
        const audio = Buffer.from(ab);
        const sampleId = nanoid(14);
        const filename = (f.name || "sample").slice(0, 200);
        const mimeType = (f.type || "application/octet-stream").slice(0, 100);

        let r2Key: string | null = null;
        if (isR2Configured()) {
          const key = `voice-clone-samples/${userId}/${id}/${sampleId}.${extFromMimeType(mimeType)}`;
          try {
            await r2PutObject({
              key,
              body: new Uint8Array(audio),
              contentType: mimeType || "application/octet-stream",
            });
            r2Key = key;
          } catch (err) {
            console.warn("[r2] voice-clone sample upload failed; falling back to DB storage:", err);
            r2Key = null;
          }
        }

        drafts.push({ sampleId, filename, mimeType, audio, r2Key });
      }

      const uploadedKeys = drafts
        .map((d) => d.r2Key)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim());

      const rowsWithR2 = drafts.map((d) => ({
        id: d.sampleId,
        cloneId: id,
        userId,
        filename: d.filename,
        mimeType: d.mimeType,
        audioKey: d.r2Key,
        audioSize: d.audio.length,
        audio: d.r2Key ? null : d.audio,
        createdAt: now,
      }));

      const rowsWithAudio = drafts.map((d) => ({
        id: d.sampleId,
        cloneId: id,
        userId,
        filename: d.filename,
        mimeType: d.mimeType,
        audioSize: d.audio.length,
        audio: d.audio,
        createdAt: now,
      }));

      const rowsAudioOnly = drafts.map((d) => ({
        id: d.sampleId,
        cloneId: id,
        userId,
        filename: d.filename,
        mimeType: d.mimeType,
        audio: d.audio,
        createdAt: now,
      }));

      try {
        await db.insert(voiceCloneSamples).values(rowsWithR2 as never);
      } catch (err) {
        const missingR2Columns = isMissingColumnError(err, "audio_key") || isMissingColumnError(err, "audio_size");
        const audioNotNull = isNotNullViolation(err, "audio");
        if (!missingR2Columns && !audioNotNull) throw err;

        // If DB requires `audio` (NOT NULL), keep the samples in DB and clean up uploaded objects.
        try {
          await db.insert(voiceCloneSamples).values(rowsWithAudio as never);
        } catch (err2) {
          if (!isMissingColumnError(err2, "audio_size")) throw err2;
          await db.insert(voiceCloneSamples).values(rowsAudioOnly as never);
        }

        if (uploadedKeys.length && isR2Configured()) {
          try {
            await r2DeleteObjects(uploadedKeys);
          } catch {
            // ignore
          }
        }
      }
    }

    return NextResponse.json({
      clone: {
        ...inserted,
        createdAt: inserted!.createdAt.toISOString(),
        updatedAt: inserted!.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    if (isMissingRelationError(err, "voice_clones")) {
      return NextResponse.json(
        { error: "Voice cloning database tables are missing. Run `pnpm db:push` to apply migrations." },
        { status: 501 },
      );
    }
    if (isMissingRelationError(err, "voice_clone_samples")) {
      return NextResponse.json(
        { error: "Voice cloning sample tables are missing. Run `pnpm db:push` to apply migrations." },
        { status: 501 },
      );
    }
    if (isMissingColumnError(err, "language_code") || isMissingColumnError(err, "model_name")) {
      return NextResponse.json(
        { error: "Voice cloning database schema is outdated. Run `pnpm db:push` to apply migrations." },
        { status: 501 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to create voice clone";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
