import { NextRequest } from "next/server";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { inferGoogleBillingTier } from "@/lib/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeLang(lang: string): string {
  const v = lang.trim();
  if (!v) return "en-US";
  if (v.length > 32) return "en-US";
  return v;
}

type ListedVoice = {
  name: string;
  languageCodes: string[];
  ssmlGender?: unknown;
  naturalSampleRateHertz?: number | null;
  billingTier: ReturnType<typeof inferGoogleBillingTier>;
  billingTierSource: "name" | "heuristic";
};

function tierRank(tier: ListedVoice["billingTier"]): number {
  switch (tier) {
    case "standard":
      return 0;
    case "wavenet":
      return 1;
    case "neural2":
      return 2;
    case "studio":
      return 3;
    case "chirp3-hd":
      return 4;
    default:
      return 9;
  }
}

let cachedAllVoices: { ts: number; voices: ListedVoice[] } | undefined;
const CACHE_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const lang = normalizeLang(normalizeString(req.nextUrl.searchParams.get("lang")) || "en-US");
  const includeAll = normalizeString(req.nextUrl.searchParams.get("all")).toLowerCase() === "1";
  const includeAliases = normalizeString(req.nextUrl.searchParams.get("aliases")).toLowerCase() === "1";
  const q = normalizeString(req.nextUrl.searchParams.get("q")).toLowerCase();

  const now = Date.now();
  if (!cachedAllVoices || now - cachedAllVoices.ts > CACHE_MS) {
    const client = new TextToSpeechClient();
    const [res] = await client.listVoices({});
    cachedAllVoices = {
      ts: now,
      voices: (res.voices ?? [])
        .map((v) => {
          const name = v.name ?? "";
          const languageCodes = v.languageCodes ?? [];
          const tierFromName = inferGoogleBillingTier(name);
          const billingTier = tierFromName;
          return {
            name,
            languageCodes,
            ssmlGender: v.ssmlGender,
            naturalSampleRateHertz: v.naturalSampleRateHertz,
            billingTier,
            billingTierSource: tierFromName !== "unknown" ? "name" : "name",
          } satisfies ListedVoice;
        })
        .filter((v) => !!v.name),
    };
  }

  try {
    const voices = (cachedAllVoices?.voices ?? [])
      .filter((v) => (includeAll ? true : v.languageCodes.includes(lang)))
      // Voices without '-' are aliases that require specifying modelName; hide them by default.
      .filter((v) => (includeAliases ? true : v.name.includes("-")))
      .filter((v) => {
        if (!q) return true;
        const hay = `${v.name} ${v.languageCodes.join(" ")} ${v.billingTier}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const diff = tierRank(a.billingTier) - tierRank(b.billingTier);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });

    return Response.json({ lang, q: q || undefined, count: voices.length, voices });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list voices";
    return Response.json(
      {
        error: message,
        hint:
          "Ensure Cloud Text-to-Speech API is enabled and the server has credentials (GOOGLE_APPLICATION_CREDENTIALS). You may also need roles/texttospeech.user + serviceusage.serviceUsageConsumer.",
      },
      { status: 502 },
    );
  }
}
