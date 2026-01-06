import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScriptRequest = {
  topic: string;
  minutes?: number;
  language?: string;
  format?: "solo" | "host_guest";
  tone?: string;
  audience?: string;
};

type PodcastScript = {
  title: string;
  description: string;
  language: string;
  minutes: number;
  segments: Array<{
    speaker: "HOST" | "GUEST";
    text: string;
  }>;
};

type ChatCompletionsResponse = {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callChatCompletions(opts: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
}): Promise<ChatCompletionsResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.7,
      messages: opts.messages,
      response_format: { type: "json_object" },
    }),
  });

  const json: unknown = await res.json();
  if (!res.ok) {
    const msg =
      isRecord(json) &&
      isRecord(json.error) &&
      typeof json.error.message === "string"
        ? json.error.message
        : undefined;
    throw new Error(msg ?? `OpenAI request failed (${res.status})`);
  }

  if (!isRecord(json) || !Array.isArray(json.choices)) {
    throw new Error("Unexpected OpenAI response shape");
  }

  return json as ChatCompletionsResponse;
}

function validateScript(script: unknown): PodcastScript {
  if (!isRecord(script)) {
    throw new Error("Invalid script payload");
  }

  const title = normalizeString(script.title);
  const description = normalizeString(script.description);
  const language = normalizeString(script.language) || "English";
  const minutes = clampInt(script.minutes, 1, 20, 5);
  const segments = Array.isArray(script.segments) ? script.segments : [];

  if (!title) throw new Error("Missing title");
  if (!description) throw new Error("Missing description");
  if (segments.length < 3) throw new Error("Script must have at least 3 segments");
  if (segments.length > 20) throw new Error("Script has too many segments");

  const normalizedSegments: PodcastScript["segments"] = segments.map((seg) => {
    if (!isRecord(seg)) {
      throw new Error("Invalid segment object");
    }
    const speaker = seg.speaker === "GUEST" ? "GUEST" : "HOST";
    const text = normalizeString(seg.text);
    if (!text) throw new Error("Empty segment text");
    if (text.length > 1200) throw new Error("Segment text too long");
    return { speaker, text };
  });

  return { title, description, language, minutes, segments: normalizedSegments };
}

export async function POST(req: NextRequest) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on server" },
      { status: 500 },
    );
  }

  let body: ScriptRequest;
  try {
    body = (await req.json()) as ScriptRequest;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const topic = normalizeString(body.topic);
  if (!topic) return badRequest("Missing topic");
  if (topic.length > 200) return badRequest("Topic too long (max 200 chars)");

  const minutes = clampInt(body.minutes, 1, 20, 5);
  const language = normalizeString(body.language) || "English";
  const format = body.format === "host_guest" ? "host_guest" : "solo";
  const tone = normalizeString(body.tone) || "friendly, concise, and energetic";
  const audience = normalizeString(body.audience) || "general listeners";

  const targetWordsPerMinute = language.toLowerCase().includes("english") ? 150 : 130;
  const targetWords = minutes * targetWordsPerMinute;

  const model = getEnv("OPENAI_MODEL_TEXT") || "gpt-4o-mini";

  const system = [
    "You write podcast scripts that sound natural when spoken aloud.",
    "Output must be valid JSON only (no markdown, no extra commentary).",
    "No emojis, no stage directions, no sound effect tags, no brackets.",
    "Keep each segment under 1,000 characters.",
  ].join("\n");

  const user = [
    `Create a podcast episode script in ${language}.`,
    `Topic: ${topic}`,
    `Audience: ${audience}`,
    `Tone: ${tone}`,
    `Format: ${format === "host_guest" ? "HOST + GUEST conversation" : "Solo HOST monologue"}`,
    `Target length: ~${minutes} minutes (~${targetWords} words).`,
    "",
    "Return JSON with this shape:",
    `{`,
    `  "title": string,`,
    `  "description": string,`,
    `  "language": string,`,
    `  "minutes": number,`,
    `  "segments": [`,
    `    { "speaker": "HOST" | "GUEST", "text": string }`,
    `  ]`,
    `}`,
    "",
    "Segment rules:",
    "- Start with a strong hook in the first segment.",
    "- Use short paragraphs and contractions where appropriate.",
    "- Add value fast; avoid long introductions.",
    "- End with a brief recap and a gentle call-to-action (subscribe/follow).",
  ].join("\n");

  try {
    const completion = await callChatCompletions({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Model returned empty content" }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = extractJsonObject(content);
    }

    const script = validateScript(parsed);
    return NextResponse.json(script);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
