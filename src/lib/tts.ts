import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import { ensureGoogleApplicationCredentials } from "@/lib/google/credentials";

export type TtsProvider = "openai" | "google" | "elevenlabs" | "azure";
export type TtsFormat = "mp3" | "wav";
export type TtsTone = "neutral" | "calm" | "serious" | "cheerful" | "excited" | "surprised";
export type GoogleVoiceSelectionParams = protos.google.cloud.texttospeech.v1.IVoiceSelectionParams;

export type TtsBillingTier =
  | "openai"
  | "azure"
  | "elevenlabs"
  | "standard"
  | "wavenet"
  | "studio"
  | "chirp3-hd"
  | "chirp-voice-cloning"
  | "neural2"
  | "unknown";

export type TtsMeta = {
  provider: TtsProvider;
  format: TtsFormat;
  voiceInput: string;
  languageCode?: string;
  voiceName?: string;
  billingTier: TtsBillingTier;
  model?: string;
};

export class TtsHttpError extends Error {
  provider: TtsProvider;
  status: number;
  body: string;

  constructor(opts: { provider: TtsProvider; status: number; body: string; message?: string }) {
    super(opts.message || `TTS failed (${opts.status})`);
    this.name = "TtsHttpError";
    this.provider = opts.provider;
    this.status = opts.status;
    this.body = opts.body;
  }
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value;
}

export function getTtsProvider(): TtsProvider {
  const raw = (getEnv("TTS_PROVIDER") || "openai").toLowerCase();
  if (raw === "google" || raw === "gcp" || raw === "google-cloud") return "google";
  if (raw === "azure" || raw === "microsoft" || raw === "ms" || raw === "speech") return "azure";
  if (raw === "elevenlabs" || raw === "eleven-labs" || raw === "11labs") return "elevenlabs";
  return "openai";
}

function bufferFromAudioContent(audioContent: unknown): Uint8Array {
  if (!audioContent) throw new Error("TTS returned empty audioContent");
  if (typeof audioContent === "string") return Buffer.from(audioContent, "base64");
  if (audioContent instanceof Uint8Array) return audioContent;
  if (Buffer.isBuffer(audioContent)) return new Uint8Array(audioContent);
  throw new Error("TTS returned unsupported audioContent type");
}

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function openAiTts(opts: {
  apiKey: string;
  model: string;
  voice: string;
  input: string;
  instructions?: string;
  format: TtsFormat;
}) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      voice: opts.voice,
      input: opts.input,
      response_format: opts.format,
      ...(opts.instructions ? { instructions: opts.instructions } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TTS failed (${res.status}): ${text || "unknown error"}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function elevenLabsTts(opts: {
  apiKey: string;
  voiceId: string;
  input: string;
  format: TtsFormat;
}) {
  const outputFormat = opts.format === "wav" ? "pcm_44100" : "mp3_44100_128";
  const url = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}`,
  );
  url.searchParams.set("output_format", outputFormat);

  const modelId = getEnv("ELEVENLABS_MODEL_ID");
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "xi-api-key": opts.apiKey,
      "Content-Type": "application/json",
      Accept: opts.format === "wav" ? "audio/wav" : "audio/mpeg",
    },
    body: JSON.stringify({
      text: opts.input,
      ...(modelId ? { model_id: modelId } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TTS failed (${res.status}): ${text || "unknown error"}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

const AZURE_VOICE_MAP: Record<string, { languageCode: string; name: string }> = {
  // OpenAI-style aliases (used by /api/generate and podcast-render)
  alloy: { languageCode: "en-US", name: "en-US-JennyNeural" },
  ash: { languageCode: "en-US", name: "en-US-GuyNeural" },
  ballad: { languageCode: "en-US", name: "en-US-AriaNeural" },
  coral: { languageCode: "en-US", name: "en-US-AmberNeural" },
  echo: { languageCode: "en-US", name: "en-US-BrandonNeural" },
  fable: { languageCode: "en-US", name: "en-US-AnaNeural" },
  nova: { languageCode: "en-US", name: "en-US-JaneNeural" },
  onyx: { languageCode: "en-US", name: "en-US-DavisNeural" },
  sage: { languageCode: "en-US", name: "en-US-AndrewNeural" },
  shimmer: { languageCode: "en-US", name: "en-US-EmmaNeural" },
  verse: { languageCode: "en-US", name: "en-US-MonicaNeural" },

  // Common language defaults (used to map Google voice selections to Azure)
  "en-US": { languageCode: "en-US", name: "en-US-JennyNeural" },
  "en-GB": { languageCode: "en-GB", name: "en-GB-SoniaNeural" },
  "zh-CN": { languageCode: "zh-CN", name: "zh-CN-XiaoxiaoNeural" },
  "zh-TW": { languageCode: "zh-TW", name: "zh-TW-HsiaoChenNeural" },
  "ja-JP": { languageCode: "ja-JP", name: "ja-JP-NanamiNeural" },
  "ko-KR": { languageCode: "ko-KR", name: "ko-KR-SunHiNeural" },
  "es-ES": { languageCode: "es-ES", name: "es-ES-ElviraNeural" },
  "es-MX": { languageCode: "es-MX", name: "es-MX-DaliaNeural" },
  "fr-FR": { languageCode: "fr-FR", name: "fr-FR-DeniseNeural" },
  "de-DE": { languageCode: "de-DE", name: "de-DE-KatjaNeural" },
  "it-IT": { languageCode: "it-IT", name: "it-IT-ElsaNeural" },
  "pt-BR": { languageCode: "pt-BR", name: "pt-BR-FranciscaNeural" },
  "ru-RU": { languageCode: "ru-RU", name: "ru-RU-SvetlanaNeural" },
  "ar-SA": { languageCode: "ar-SA", name: "ar-SA-ZariyahNeural" },
  "id-ID": { languageCode: "id-ID", name: "id-ID-GadisNeural" },
};

export function resolveAzureVoice(voiceInput: string): { languageCode: string; name: string } {
  const forcedName = getEnv("AZURE_TTS_VOICE_NAME");
  if (forcedName) {
    const forcedLanguage = getEnv("AZURE_TTS_LANGUAGE_CODE") || forcedName.split("-").slice(0, 2).join("-") || "en-US";
    return { languageCode: forcedLanguage, name: forcedName };
  }

  const raw = (voiceInput || "").trim();
  const normalized = raw.startsWith("azure:") ? raw.slice("azure:".length).trim() : raw;
  const mapped = AZURE_VOICE_MAP[normalized];
  if (mapped) return mapped;

  // If it's already an Azure voice name (common pattern: xx-XX-NameNeural)
  if (/^[a-z]{2,3}-[A-Z]{2}-/.test(normalized) && /Neural$/i.test(normalized)) {
    const languageCode = normalized.split("-").slice(0, 2).join("-") || "en-US";
    return { languageCode, name: normalized };
  }

  // If it's a Google voice name, derive a reasonable default from its BCP-47 prefix.
  if (/^[a-z]{2,3}-[A-Z]{2}-/.test(normalized)) {
    const languageCode = normalized.split("-").slice(0, 2).join("-") || "en-US";
    if (languageCode === "cmn-CN") return { languageCode: "zh-CN", name: "zh-CN-XiaoxiaoNeural" };
    return AZURE_VOICE_MAP[languageCode] ?? { languageCode: "en-US", name: "en-US-JennyNeural" };
  }

  return { languageCode: "en-US", name: "en-US-JennyNeural" };
}

function azureOutputFormat(format: TtsFormat): string {
  return format === "wav" ? "riff-16khz-16bit-mono-pcm" : "audio-16khz-32kbitrate-mono-mp3";
}

function azureProsodyRate(speakingRate: number | undefined): string | null {
  if (typeof speakingRate !== "number" || !Number.isFinite(speakingRate)) return null;
  const pct = Math.round((speakingRate - 1) * 100);
  const clamped = Math.max(-80, Math.min(200, pct));
  return clamped >= 0 ? `+${clamped}%` : `${clamped}%`;
}

function azureProsodyVolume(volumeGainDb: number | undefined): string | null {
  if (typeof volumeGainDb !== "number" || !Number.isFinite(volumeGainDb) || volumeGainDb === 0) return null;
  const clamped = Math.max(-96, Math.min(16, Math.round(volumeGainDb)));
  return clamped >= 0 ? `+${clamped}dB` : `${clamped}dB`;
}

async function azureSpeechTts(opts: {
  input: string;
  voiceInput: string;
  format: TtsFormat;
  tone: TtsTone;
  volumeGainDb: number;
  speakingRate?: number;
}) {
  const key = getEnv("AZURE_SPEECH_KEY");
  const region = getEnv("AZURE_SPEECH_REGION");
  if (!key) throw new Error("Missing AZURE_SPEECH_KEY on server");
  if (!region) throw new Error("Missing AZURE_SPEECH_REGION on server");

  const resolved = resolveAzureVoice(opts.voiceInput);
  const safeText = escapeSsml(opts.input);

  const pitchByTone: Record<TtsTone, string | null> = {
    neutral: null,
    calm: "-2st",
    serious: "-1st",
    cheerful: "+1st",
    excited: "+2st",
    surprised: "+4st",
  };

  const rate = azureProsodyRate(opts.speakingRate);
  const volume = azureProsodyVolume(opts.volumeGainDb);
  const pitch = pitchByTone[opts.tone] ?? null;

  const prosodyAttrs: string[] = [];
  if (rate) prosodyAttrs.push(`rate="${rate}"`);
  if (volume) prosodyAttrs.push(`volume="${volume}"`);
  if (pitch) prosodyAttrs.push(`pitch="${pitch}"`);

  const prosodyOpen = prosodyAttrs.length ? `<prosody ${prosodyAttrs.join(" ")}>` : "<prosody>";
  const ssml = [
    `<speak version="1.0" xml:lang="${resolved.languageCode}" xmlns="http://www.w3.org/2001/10/synthesis">`,
    `<voice name="${resolved.name}">`,
    `${prosodyOpen}${safeText}</prosody>`,
    `</voice>`,
    `</speak>`,
  ].join("");

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": azureOutputFormat(opts.format),
    },
    body: ssml,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TtsHttpError({ provider: "azure", status: res.status, body: text || "" });
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

const GOOGLE_VOICE_MAP: Record<string, { languageCode: string; name: string }> = {
  alloy: { languageCode: "en-US", name: "en-US-Wavenet-D" },
  ash: { languageCode: "en-US", name: "en-US-Wavenet-C" },
  ballad: { languageCode: "en-US", name: "en-US-Wavenet-A" },
  coral: { languageCode: "en-US", name: "en-US-Wavenet-F" },
  echo: { languageCode: "en-US", name: "en-US-Wavenet-B" },
  fable: { languageCode: "en-US", name: "en-US-Wavenet-E" },
  nova: { languageCode: "en-US", name: "en-US-Wavenet-G" },
  onyx: { languageCode: "en-US", name: "en-US-Wavenet-H" },
  sage: { languageCode: "en-US", name: "en-US-Wavenet-I" },
  shimmer: { languageCode: "en-US", name: "en-US-Wavenet-J" },
  verse: { languageCode: "en-US", name: "en-US-Standard-C" },
};

let googleClient: TextToSpeechClient | undefined;
function getGoogleClient(): TextToSpeechClient {
  if (!googleClient) {
    ensureGoogleApplicationCredentials();
    googleClient = new TextToSpeechClient();
  }
  return googleClient;
}

function resolveGoogleVoice(voice: string): { languageCode: string; name?: string } {
  const forcedName = getEnv("GOOGLE_TTS_VOICE_NAME");
  if (forcedName) {
    return { languageCode: getEnv("GOOGLE_TTS_LANGUAGE_CODE") || "en-US", name: forcedName };
  }

  const mapped = GOOGLE_VOICE_MAP[voice];
  if (mapped) return mapped;

  const fallbackLanguageCode = getEnv("GOOGLE_TTS_LANGUAGE_CODE") || "en-US";

  // Allow passing a full Google voice name via request.
  if (voice.includes("-")) {
    const languageCode = voice.split("-").slice(0, 2).join("-");
    return { languageCode: languageCode || fallbackLanguageCode, name: voice };
  }

  // Some Chirp3-HD voices are exposed as aliases (e.g. "Umbriel") but require a model-qualified name.
  // Prefer expanding to the fully-qualified Chirp3-HD voice when it looks like a star-name alias.
  if (/^[A-Z][A-Za-z0-9_]+$/.test(voice)) {
    return { languageCode: fallbackLanguageCode, name: `${fallbackLanguageCode}-Chirp3-HD-${voice}` };
  }

  // Fallback to Google default for the language if the input isn't a known voice.
  return { languageCode: fallbackLanguageCode };
}

export function inferGoogleBillingTier(voiceName?: string): TtsBillingTier {
  if (!voiceName) return "unknown";
  const normalized = voiceName.toLowerCase();
  if (normalized.includes("chirp3-hd")) return "chirp3-hd";
  if (normalized.includes("studio")) return "studio";
  if (normalized.includes("wavenet")) return "wavenet";
  if (normalized.includes("neural2")) return "neural2";
  if (normalized.includes("standard")) return "standard";
  return "unknown";
}

export function getTtsMeta(opts: {
  provider: TtsProvider;
  voice: string;
  format: TtsFormat;
  openAiModel?: string;
}): TtsMeta {
  if (opts.provider === "azure") {
    const resolved = resolveAzureVoice(opts.voice);
    return {
      provider: "azure",
      format: opts.format,
      voiceInput: opts.voice,
      languageCode: resolved.languageCode,
      voiceName: resolved.name,
      billingTier: "azure",
    };
  }

  if (opts.provider === "google") {
    const resolved = resolveGoogleVoice(opts.voice);
    return {
      provider: "google",
      format: opts.format,
      voiceInput: opts.voice,
      languageCode: resolved.languageCode,
      voiceName: resolved.name,
      billingTier: inferGoogleBillingTier(resolved.name),
    };
  }

  if (opts.provider === "elevenlabs") {
    return {
      provider: "elevenlabs",
      format: opts.format,
      voiceInput: opts.voice,
      voiceName: opts.voice,
      billingTier: "elevenlabs",
    };
  }

  return {
    provider: "openai",
    format: opts.format,
    voiceInput: opts.voice,
    voiceName: opts.voice,
    billingTier: "openai",
    model: opts.openAiModel,
  };
}

async function googleCloudTts(opts: {
  voice: string;
  input: string;
  format: TtsFormat;
  tone: TtsTone;
  volumeGainDb: number;
  speakingRate?: number;
  voiceSelection?: GoogleVoiceSelectionParams;
}) {
  const audioEncoding =
    opts.format === "wav"
      ? protos.google.cloud.texttospeech.v1.AudioEncoding.LINEAR16
      : protos.google.cloud.texttospeech.v1.AudioEncoding.MP3;
  const voice: GoogleVoiceSelectionParams = opts.voiceSelection ?? resolveGoogleVoice(opts.voice);

  // Prefer audioConfig controls for speed/volume since some voices don't fully honor SSML prosody rate/volume.
  const audioConfig: protos.google.cloud.texttospeech.v1.IAudioConfig = {
    audioEncoding,
    volumeGainDb: opts.volumeGainDb,
    ...(typeof opts.speakingRate === "number" ? { speakingRate: opts.speakingRate } : {}),
  };

  const safeText = escapeSsml(opts.input);
  const ssmlByTone: Record<Exclude<TtsTone, "neutral">, string> = {
    calm: `<speak><prosody pitch="-2st"><emphasis level="reduced">${safeText}</emphasis></prosody></speak>`,
    serious: `<speak><prosody pitch="-1st"><emphasis level="moderate">${safeText}</emphasis></prosody></speak>`,
    cheerful: `<speak><prosody pitch="+1st"><emphasis level="moderate">${safeText}</emphasis></prosody></speak>`,
    excited: `<speak><prosody pitch="+2st"><emphasis level="strong">${safeText}</emphasis></prosody></speak>`,
    surprised: `<speak><prosody pitch="+4st"><emphasis level="strong">${safeText}</emphasis></prosody></speak>`,
  };

  const input: protos.google.cloud.texttospeech.v1.ISynthesisInput =
    opts.tone === "neutral" ? { text: opts.input } : { ssml: ssmlByTone[opts.tone] };

  const [response] = await getGoogleClient().synthesizeSpeech({
    input,
    voice,
    audioConfig,
  });

  return bufferFromAudioContent(response.audioContent);
}

export async function synthesizeTts(opts: {
  provider: TtsProvider;
  input: string;
  voice: string;
  format: TtsFormat;
  tone?: TtsTone;
  volumeGainDb?: number;
  speakingRate?: number;
  instructions?: string;
  openAi?: { apiKey: string; model: string };
  elevenLabs?: { apiKey: string };
  google?: { voiceSelection?: GoogleVoiceSelectionParams };
}) {
  if (opts.provider === "elevenlabs") {
    if (!opts.elevenLabs?.apiKey) throw new Error("Missing ELEVENLABS_API_KEY on server");
    return elevenLabsTts({
      apiKey: opts.elevenLabs.apiKey,
      voiceId: opts.voice,
      input: opts.input,
      format: opts.format,
    });
  }

  if (opts.provider === "azure") {
    return azureSpeechTts({
      input: opts.input,
      voiceInput: opts.voice,
      format: opts.format,
      tone:
        opts.tone === "calm" ||
        opts.tone === "serious" ||
        opts.tone === "cheerful" ||
        opts.tone === "excited" ||
        opts.tone === "surprised"
          ? opts.tone
          : "neutral",
      volumeGainDb: typeof opts.volumeGainDb === "number" ? opts.volumeGainDb : 0,
      speakingRate: typeof opts.speakingRate === "number" ? opts.speakingRate : undefined,
    });
  }

  if (opts.provider === "google") {
    // Google Cloud Text-to-Speech does not support OpenAI-style "instructions" for voice acting.
    return googleCloudTts({
      voice: opts.voice,
      input: opts.input,
      format: opts.format,
      tone:
        opts.tone === "calm" ||
        opts.tone === "serious" ||
        opts.tone === "cheerful" ||
        opts.tone === "excited" ||
        opts.tone === "surprised"
          ? opts.tone
          : "neutral",
      volumeGainDb: typeof opts.volumeGainDb === "number" ? opts.volumeGainDb : 0,
      speakingRate: typeof opts.speakingRate === "number" ? opts.speakingRate : undefined,
      voiceSelection: opts.google?.voiceSelection,
    });
  }

  if (!opts.openAi?.apiKey) throw new Error("Missing OPENAI_API_KEY on server");
  const model = opts.openAi.model || "gpt-4o-mini-tts";
  return openAiTts({
    apiKey: opts.openAi.apiKey,
    model,
    voice: opts.voice,
    input: opts.input,
    instructions: opts.instructions,
    format: opts.format,
  });
}
