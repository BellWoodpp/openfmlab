import { TextToSpeechClient } from "@google-cloud/text-to-speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cached = { ts: number; languages: string[] };
let cached: Cached | undefined;
const CACHE_MS = 10 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  if (!cached || now - cached.ts > CACHE_MS) {
    const client = new TextToSpeechClient();
    const [res] = await client.listVoices({});
    const set = new Set<string>();
    for (const v of res.voices ?? []) {
      for (const lc of v.languageCodes ?? []) set.add(lc);
    }
    cached = { ts: now, languages: Array.from(set).sort((a, b) => a.localeCompare(b)) };
  }

  return Response.json({ count: cached.languages.length, languages: cached.languages });
}
