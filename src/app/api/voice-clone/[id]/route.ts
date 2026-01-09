import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { voiceClones } from "@/lib/db/schema/voiceClones";
import { isVoiceCloningEnabled } from "@/lib/voice-cloning-enabled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isMissingColumnError(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  if (code === "42703") {
    return typeof message === "string" && message.toLowerCase().includes(column.toLowerCase());
  }
  return typeof message === "string" && message.includes(`column \"${column}\" does not exist`);
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

async function deleteFromElevenLabs(opts: { apiKey: string; providerVoiceId: string }) {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(opts.providerVoiceId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": opts.apiKey },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ElevenLabs delete failed (${res.status}): ${text || "unknown error"}`);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = normalizeString((body as { name?: unknown })?.name).slice(0, 40);
  const setDefault = (body as { isDefault?: unknown })?.isDefault === true;
  const bindVoiceCloningKey = normalizeString((body as { voiceCloningKey?: unknown })?.voiceCloningKey);
  const markReady = (body as { status?: unknown })?.status === "ready";

  if (!name && !setDefault && !bindVoiceCloningKey && !markReady) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const now = new Date();

  if (setDefault) {
    try {
      await db
        .update(voiceClones)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(voiceClones.userId, userId));
    } catch (err) {
      if (isMissingColumnError(err, "language_code") || isMissingColumnError(err, "model_name")) {
        return NextResponse.json(
          { error: "Voice cloning database schema is outdated. Run `pnpm db:push` to apply migrations." },
          { status: 501 },
        );
      }
      throw err;
    }
  }

  let updated:
    | {
        id: string;
        name: string;
        status: string;
        provider: string;
        providerVoiceId: string | null;
        languageCode: string;
        modelName: string | null;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined;
  try {
    const admin = await isAdmin(req);
    if ((bindVoiceCloningKey || markReady) && !admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    [updated] = await db
      .update(voiceClones)
      .set({
        ...(name ? { name } : {}),
        ...(setDefault ? { isDefault: true } : {}),
        ...(admin && bindVoiceCloningKey ? { providerVoiceId: bindVoiceCloningKey.slice(0, 2048) } : {}),
        ...(admin && markReady ? { status: "ready" } : {}),
        updatedAt: now,
      })
      .where(and(eq(voiceClones.userId, userId), eq(voiceClones.id, id)))
      .returning({
        id: voiceClones.id,
        name: voiceClones.name,
        status: voiceClones.status,
        provider: voiceClones.provider,
        providerVoiceId: voiceClones.providerVoiceId,
        languageCode: voiceClones.languageCode,
        modelName: voiceClones.modelName,
        isDefault: voiceClones.isDefault,
        createdAt: voiceClones.createdAt,
        updatedAt: voiceClones.updatedAt,
      });
  } catch (err) {
    if (isMissingColumnError(err, "language_code") || isMissingColumnError(err, "model_name")) {
      return NextResponse.json(
        { error: "Voice cloning database schema is outdated. Run `pnpm db:push` to apply migrations." },
        { status: 501 },
      );
    }
    throw err;
  }

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    clone: {
      ...updated,
      // Do not leak the key to clients; it is stored server-side.
      providerVoiceId: null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const [existing] = await db
    .select({
      id: voiceClones.id,
      provider: voiceClones.provider,
      providerVoiceId: voiceClones.providerVoiceId,
    })
    .from(voiceClones)
    .where(and(eq(voiceClones.userId, userId), eq(voiceClones.id, id)));

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(voiceClones).where(and(eq(voiceClones.userId, userId), eq(voiceClones.id, id)));

  const shouldDeleteUpstream = process.env.ELEVENLABS_DELETE_ON_REMOVE === "1";
  if (shouldDeleteUpstream && existing.provider === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey && existing.providerVoiceId) {
      try {
        await deleteFromElevenLabs({ apiKey, providerVoiceId: existing.providerVoiceId });
      } catch (err) {
        console.warn(err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
