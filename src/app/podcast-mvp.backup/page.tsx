"use client";

import { useMemo, useState } from "react";

type ScriptSegment = { speaker: "HOST" | "GUEST"; text: string };
type PodcastScript = {
  title: string;
  description: string;
  language: string;
  minutes: number;
  segments: ScriptSegment[];
};

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;
type Voice = (typeof VOICES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  return typeof payload.error === "string" ? payload.error : undefined;
}

export default function Page() {
  const [topic, setTopic] = useState("How to start a podcast in 2026");
  const [minutes, setMinutes] = useState(5);
  const [language, setLanguage] = useState("English");
  const [format, setFormat] = useState<"solo" | "host_guest">("host_guest");
  const [tone, setTone] = useState("friendly, punchy, and practical");
  const [audience, setAudience] = useState("busy creators");

  const [script, setScript] = useState<PodcastScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isRenderingAudio, setIsRenderingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [voiceHost, setVoiceHost] = useState<Voice>("alloy");
  const [voiceGuest, setVoiceGuest] = useState<Voice>("nova");
  const [pauseMs, setPauseMs] = useState(250);
  const [instructions, setInstructions] = useState("Speak clearly, like a podcast host. Natural pacing, not too fast.");

  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const canRenderAudio = !!script && script.segments.length > 0 && !isGeneratingScript && !isRenderingAudio;

  const approxWords = useMemo(() => {
    const wpm = language.toLowerCase().includes("english") ? 150 : 130;
    return minutes * wpm;
  }, [language, minutes]);

  async function generateScript() {
    setError(null);
    setAudioUrl(null);
    setIsGeneratingScript(true);
    try {
      const res = await fetch("/api/podcast/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, minutes, language, format, tone, audience }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(getErrorMessage(json) ?? `Failed (${res.status})`);
      setScript(json as PodcastScript);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsGeneratingScript(false);
    }
  }

  async function renderAudio() {
    if (!script) return;
    setError(null);
    setIsRenderingAudio(true);
    try {
      const res = await fetch("/api/podcast/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: script.title,
          segments: script.segments,
          voices: { HOST: voiceHost, GUEST: voiceGuest },
          pauseMs,
          instructions,
        }),
      });
      if (!res.ok) {
        let detail: string | undefined;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json: unknown = await res.json().catch(() => null);
          detail = getErrorMessage(json);
        } else {
          const text = await res.text().catch(() => "");
          detail = text.trim() || undefined;
        }
        throw new Error(detail ?? `Render failed (${res.status})`);
      }
      const blob = await res.blob();
      const nextUrl = URL.createObjectURL(blob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsRenderingAudio(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 px-5 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">OpenFM Audio</h1>
          <p className="mt-2 text-neutral-300">
            Generate a full podcast script, then voice it with OpenAI TTS. MVP for content creators.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-neutral-300">Topic</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-neutral-300">Length</span>
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                <option value={3}>~3 minutes</option>
                <option value={5}>~5 minutes</option>
                <option value={8}>~8 minutes</option>
                <option value={10}>~10 minutes</option>
              </select>
              <span className="text-xs text-neutral-400">Target ~{approxWords} words</span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-neutral-300">Language</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-neutral-300">Format</span>
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                value={format}
                onChange={(e) => setFormat(e.target.value === "host_guest" ? "host_guest" : "solo")}
              >
                <option value="host_guest">Host + Guest</option>
                <option value="solo">Solo host</option>
              </select>
            </label>

            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm text-neutral-300">Tone</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              />
            </label>

            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm text-neutral-300">Audience</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
              disabled={isGeneratingScript || !topic.trim()}
              onClick={generateScript}
            >
              {isGeneratingScript ? "Generating…" : "Generate Script"}
            </button>

            <button
              className="rounded-lg border border-white/15 bg-white/0 px-4 py-2 text-sm font-medium disabled:opacity-60"
              disabled={!canRenderAudio}
              onClick={renderAudio}
            >
              {isRenderingAudio ? "Rendering…" : "Render Audio (WAV)"}
            </button>

            <p className="text-xs text-neutral-400">
              Uses your server-side `OPENAI_API_KEY`. You’re responsible for API costs.
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </section>

        {script ? (
          <section className="mt-8 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Episode</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm text-neutral-300">Title</span>
                  <input
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                    value={script.title}
                    onChange={(e) => setScript({ ...script, title: e.target.value })}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-neutral-300">Description</span>
                  <textarea
                    className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                    value={script.description}
                    onChange={(e) => setScript({ ...script, description: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Voices</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-neutral-300">Host voice</span>
                  <select
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                    value={voiceHost}
                    onChange={(e) => setVoiceHost(e.target.value as Voice)}
                  >
                    {VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-neutral-300">Guest voice</span>
                  <select
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                    value={voiceGuest}
                    onChange={(e) => setVoiceGuest(e.target.value as Voice)}
                  >
                    {VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-neutral-300">Pause between segments (ms)</span>
                  <input
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                    type="number"
                    min={0}
                    max={2000}
                    value={pauseMs}
                    onChange={(e) => setPauseMs(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm text-neutral-300">Delivery instructions (optional)</span>
                  <textarea
                    className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-white/20"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Script segments</h2>
                <button
                  className="rounded-lg border border-white/15 bg-white/0 px-3 py-1.5 text-xs font-medium"
                  onClick={() =>
                    setScript({
                      ...script,
                      segments: [...script.segments, { speaker: "HOST", text: "" }],
                    })
                  }
                >
                  + Add segment
                </button>
              </div>

              <div className="mt-4 grid gap-4">
                {script.segments.map((seg, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400">#{idx + 1}</span>
                        <select
                          className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                          value={seg.speaker}
                          onChange={(e) => {
                            const speaker = e.target.value === "GUEST" ? "GUEST" : "HOST";
                            const next = [...script.segments];
                            next[idx] = { ...next[idx]!, speaker };
                            setScript({ ...script, segments: next });
                          }}
                        >
                          <option value="HOST">HOST</option>
                          <option value="GUEST">GUEST</option>
                        </select>
                      </div>
                      <button
                        className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-200 hover:bg-white/5"
                        onClick={() => {
                          const next = script.segments.filter((_, i) => i !== idx);
                          setScript({ ...script, segments: next });
                        }}
                        disabled={script.segments.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
                      value={seg.text}
                      onChange={(e) => {
                        const next = [...script.segments];
                        next[idx] = { ...next[idx]!, text: e.target.value };
                        setScript({ ...script, segments: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {audioUrl ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold">Audio</h2>
                <audio className="mt-4 w-full" controls src={audioUrl} />
                <a
                  className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                  href={audioUrl}
                  download={`${script.title || "openfm-episode"}.wav`}
                >
                  Download WAV
                </a>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
            Generate a script first. Then you can edit it and render the full episode audio.
          </section>
        )}

        <footer className="mt-10 text-xs text-neutral-500">
          MVP notes: audio is rendered as WAV by concatenating per-segment TTS output with short pauses.
        </footer>
      </div>
    </main>
  );
}
