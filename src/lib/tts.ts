import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";

export type TtsProvider = "openai" | "google" | "elevenlabs";
export type TtsFormat = "mp3" | "wav";
export type TtsTone = "neutral" | "calm" | "serious" | "cheerful" | "excited" | "surprised";
export type GoogleVoiceSelectionParams = protos.google.cloud.texttospeech.v1.IVoiceSelectionParams;

export type TtsBillingTier =
  | "openai"
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

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value;
}

export function getTtsProvider(): TtsProvider {
  const raw = (getEnv("TTS_PROVIDER") || "openai").toLowerCase();
  if (raw === "google" || raw === "gcp" || raw === "google-cloud") return "google";
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
  if (!googleClient) googleClient = new TextToSpeechClient();
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
