"use client";
import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Header } from "./ui/Header";
import { Docs, Waveform, Refresh, Star, Share } from "./ui/Icons";
import { useBodyScrollable } from "@/hooks/useBodyScrollable";
import { Block } from "./ui/Block";
import { Footer } from "./ui/Footer";
import { appStore } from "@/lib/store";
import BrowserNotSupported from "./ui/BrowserNotSupported";
import PlayButton from "./PlayButton";
import DownloadButton from "./DownloadButton";
import { ShareButton } from "./ShareButton";
import GoogleVoicePicker from "./GoogleVoicePicker";

type ViewType = 'tts' | 'cloning';

export default function TtsPage() {
  const [currentView, setCurrentView] = useState<ViewType>('tts');
  const isScrollable = useBodyScrollable();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <main
          data-scrollable={isScrollable}
          className="flex-1 overflow-y-auto px-5 pt-6 pb-32 md:pb-24"
        >
          <div className="max-w-[1300px] mx-auto">
             <Header />
             {currentView === 'tts' ? <TTSBoard /> : <CloningBoard />}
             <Footer />
          </div>
        </main>
      </div>
    </div>
  );
}

const Sidebar = ({ currentView, onViewChange }: { currentView: ViewType; onViewChange: (view: ViewType) => void }) => {
  const avatarSrc = process.env.NEXT_PUBLIC_AVATAR_SRC || "/avatar-placeholder.svg";

  return (
    <aside className="w-64 bg-background border-r border-border hidden md:flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
             <Waveform className="text-white w-5 h-5" />
           </div>
           <span className="font-bold text-lg tracking-tight">Voiceslab</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        <SidebarItem 
          icon={<Docs className="w-5 h-5" />} 
          label="Text to Speech" 
          active={currentView === 'tts'} 
          onClick={() => onViewChange('tts')}
        />
        <SidebarItem 
          icon={<Waveform className="w-5 h-5" />} 
          label="Voice Cloning" 
          active={currentView === 'cloning'}
          onClick={() => onViewChange('cloning')}
        />
        <SidebarItem icon={<Refresh className="w-5 h-5" />} label="History" />
      </nav>

      <div className="px-4 py-2 mt-auto">
        <div className="space-y-1 mb-6">
           <SidebarItem icon={<Star className="w-5 h-5" />} label="Options" /> 
        </div>
        
        <div className="p-3 rounded-lg bg-muted/50 border border-border flex items-center gap-3 mb-6">
            <img
              src={avatarSrc}
              alt="User avatar"
              className="w-8 h-8 rounded-full shrink-0 object-cover bg-muted"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.src.endsWith("/avatar-placeholder.svg")) return;
                el.src = "/avatar-placeholder.svg";
              }}
            />
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">chenglong LI</div>
                <div className="text-xs text-muted-foreground truncate">0 Clone Credits</div>
            </div>
        </div>
      </div>
    </aside>
  );
};

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const TTSBoard = () => {
  const voice = appStore.useState((state) => state.voice);
  const tone = appStore.useState((state) => state.tone);
  const speakingRateMode = appStore.useState((state) => state.speakingRateMode);
  const speakingRate = appStore.useState((state) => state.speakingRate);
  const playbackRate = appStore.useState((state) => state.playbackRate);
  const volumeGainDb = appStore.useState((state) => state.volumeGainDb);
  const input = appStore.useState((state) => state.input);
  const latestAudioBlobUrl = appStore.useState((state) => state.latestAudioBlobUrl);
  const ttsHistory = appStore.useState((state) => state.ttsHistory);
  const browserNotSupported = appStore.useState(
    () => !("serviceWorker" in navigator)
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    fetch("/api/tts/history?limit=20")
      .then(async (res) => {
        if (!res.ok) {
          const details = await res.text().catch(() => "");
          throw new Error(details || `Failed to load history (${res.status})`);
        }
        return res.json() as Promise<{
          items: Array<{
            id: string;
            createdAt: string;
            voice: string;
            tone: string;
            audioUrl: string;
          }>;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        appStore.setState((draft) => {
          draft.ttsHistory = data.items.map((it) => ({
            id: it.id,
            createdAt: it.createdAt,
            voice: it.voice,
            tone:
              it.tone === "calm" ||
              it.tone === "serious" ||
              it.tone === "cheerful" ||
              it.tone === "excited" ||
              it.tone === "surprised"
                ? it.tone
                : "neutral",
            audioUrl: it.audioUrl,
          }));
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setHistoryError(err instanceof Error ? err.message : "Failed to load history");
      })
      .finally(() => {
        if (cancelled) return;
        setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full w-full relative">
      {browserNotSupported && (
        <BrowserNotSupported
          open={browserNotSupported}
          onOpenChange={() => {}}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6 h-full pb-6">
        {/* Left Column: Text Input & Controls (1/2 Width) */}
        <div className="lg:flex-1 flex flex-col min-w-0 h-full">
          <Block title="Text to speech">
            <div className="relative flex flex-col h-full w-full">
              <textarea
                id="input"
                className="w-full min-h-[400px] lg:min-h-[450px] flex-1 resize-none outline-none focus:outline-none bg-screen p-6 rounded-xl shadow-textarea text-[18px] md:text-[16px] leading-relaxed"
                value={input}
                onChange={({ target }) => {
                  appStore.setState((draft) => {
                    draft.input = target.value;
                    draft.latestAudioUrl = null;
                    draft.latestAudioBlobUrl = null;
                  });
                }}
                placeholder="Enter text to generate speech…"
              />
              <span className="absolute bottom-4 right-6 z-10 opacity-30 hidden sm:block font-mono text-sm">
                {input.length} / 5000
              </span>
            </div>


            {/* Controls */}
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-3">
                  Tone
                  <select
                    value={tone}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next =
                        raw === "calm" ||
                        raw === "serious" ||
                        raw === "cheerful" ||
                        raw === "excited" ||
                        raw === "surprised"
                          ? raw
                          : "neutral";
                      appStore.setState((draft) => {
                        draft.tone = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="neutral">Neutral</option>
                    <option value="calm">Calm</option>
                    <option value="serious">Serious</option>
                    <option value="cheerful">Cheerful</option>
                    <option value="excited">Excited</option>
                    <option value="surprised">Surprised</option>
                  </select>
                </label>

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-3">
                  Speed
                  <select
                    value={speakingRateMode}
                    onChange={(e) => {
                      const next = e.target.value === "custom" ? "custom" : "auto";
                      appStore.setState((draft) => {
                        draft.speakingRateMode = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="auto">Auto</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                {speakingRateMode === "custom" ? (
                  <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                    <div className="flex justify-between">
                      <span>Rate</span>
                      <span className="font-mono text-foreground">{speakingRate.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={speakingRate}
                      onChange={(e) => {
                        const next = Math.max(0.25, Math.min(4, Number(e.target.value) || 1));
                        appStore.setState((draft) => {
                          draft.speakingRate = next;
                          draft.latestAudioUrl = null;
                          draft.latestAudioBlobUrl = null;
                        });
                      }}
                      className="w-full mt-1.5"
                    />
                  </label>
                ) : null}

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                  <div className="flex justify-between">
                    <span>Playback</span>
                    <span className="font-mono text-foreground">{playbackRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.05}
                    value={playbackRate}
                    onChange={(e) => {
                      const next = Math.max(0.25, Math.min(4, Number(e.target.value) || 1));
                      appStore.setState((draft) => {
                        draft.playbackRate = next;
                      });
                    }}
                    className="w-full mt-1.5"
                  />
                  <div className="text-[11px] leading-4 text-muted-foreground">
                    只影响播放倍速（更接近严格倍速），不会重新生成音频，也不会增加合成用量。
                  </div>
                </label>

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                  <div className="flex justify-between">
                    <span>Volume</span>
                    <span className="font-mono text-foreground">{volumeGainDb > 0 ? `+${volumeGainDb}` : volumeGainDb}dB</span>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={1}
                    value={volumeGainDb}
                    onChange={(e) => {
                      const next = Math.max(-96, Math.min(16, Math.round(Number(e.target.value) || 0)));
                      appStore.setState((draft) => {
                        draft.volumeGainDb = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full mt-1.5"
                  />
                </label>
              </div>

              {speakingRateMode === "custom" ? (
                <div className="rounded-xl border border-border bg-background/60 p-4 text-[11px] leading-4 text-muted-foreground">
                  <div className="font-medium text-foreground/80">为什么体感可能不像 4x？</div>
                  <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li>
                      它是“相对语速/韵律目标”：Google 会重新合成语音（不是把音频简单时间拉伸），为了可懂度/自然度会做限制，所以体感不一定线性。
                    </li>
                    <li>
                      停顿不一定等比例缩短：句号/逗号/换行带来的停顿、强调、断句有一部分是“固定成本”，即使你提速，停顿可能缩得没那么多，整体听感就不像 4x。
                    </li>
                    <li>
                      不同 voice 的响应差异很大：尤其像 Chirp3‑HD（Despina）这类，模型会更“稳”，提速更保守，实际提升幅度可能明显小于你预期。
                    </li>
                    <li>如果你想要更快的语速，可以改用上面的 Playback（播放倍速）。</li>
                  </ul>
                </div>
              ) : null}

	              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-border/50">
	                <div className="text-[11px] text-muted-foreground italic">
	                  Tip: switching Language auto-picks a safe default; click a card to pin a voice for that language.
	                </div>
	                <div className="flex flex-row gap-3 w-full sm:w-auto">
	                  <DownloadButton />
	                  <ShareButton />
	                  <div className="flex-1 sm:min-w-[120px]">
	                    <PlayButton />
	                  </div>
	                </div>
	              </div>

	            {/* Generated History: only appears after clicking Play */}
		            <div className="mt-8 border-t border-border pt-6">
		              <div className="flex items-center justify-between mb-4">
		                <h3 className="text-sm font-semibold text-foreground">Generated History</h3>
		                <span className="text-xs text-muted-foreground">
		                  {ttsHistory.length}
		                </span>
		              </div>

		              {historyLoading ? (
		                <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
		                  Loading history…
		                </div>
		              ) : historyError ? (
		                <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
		                  {historyError.includes("no auth")
		                    ? "Sign in to sync history across devices."
		                    : historyError}
		                </div>
		              ) : ttsHistory.length === 0 ? (
		                <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
		                  No audio yet. Click <span className="font-medium text-foreground">Play</span> to generate your first MP3.
		                </div>
		              ) : (
		                <div className="space-y-3">
		                  {ttsHistory.slice(0, 10).map((item) => (
		                    <div
		                      key={item.id}
		                      className="rounded-xl border border-border bg-background/60 p-4 space-y-3"
		                    >
		                      <div className="flex items-center justify-between gap-3">
		                        <div className="min-w-0">
		                          <div className="text-sm font-medium text-foreground truncate">
		                            {item.voice} · {item.tone}
		                          </div>
		                          <div className="text-xs text-muted-foreground">
		                            {new Date(item.createdAt).toLocaleString()}
		                          </div>
		                        </div>
		                        <div className="flex items-center gap-3 shrink-0">
		                          <a
		                            className="text-xs font-medium text-primary underline underline-offset-4"
		                            href={item.audioUrl}
		                            download={`voiceslab-${item.voice}.mp3`}
		                          >
		                            Download
		                          </a>
		                          <ShareButton generationId={item.id} />
		                        </div>
		                      </div>
		                      <audio className="w-full" controls preload="metadata" src={item.audioUrl} />
		                    </div>
		                  ))}
		                </div>
		              )}
		            </div>
	            </div>
	          </Block>
	        </div>

        {/* Right Column: Voice Selection Only (1/2 Width) */}
        <div className="lg:flex-1 flex flex-col shrink-0 h-full">
          <Block title="Select a voice">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-hidden flex flex-col min-h-[400px] lg:min-h-[600px]">
                <GoogleVoicePicker />
              </div>
            </div>
          </Block>
        </div>
      </div>
    </div>
  );
};

const CloningBoard = () => {
  return (
    <div className="mt-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Voice Cloning</h1>
        <p className="text-muted-foreground">With instant voice cloning, recreate your and any of your favorite sounds in just a few seconds.</p>
      </div>

      <div className="bg-screen border border-border rounded-2xl p-8 max-w-3xl">
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center mb-6 hover:border-primary/50 transition-colors cursor-pointer group">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
             <Share className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium mb-1 text-center">Click to upload or drag and drop</div>
          <div className="text-xs text-muted-foreground text-center">Format: MP3, WAV, OGG</div>
          <div className="text-xs text-muted-foreground text-center">Size: Up to 10MB</div>
        </div>

        <div className="relative flex items-center justify-center mb-6">
           <div className="absolute inset-0 flex items-center">
             <div className="w-full border-t border-border"></div>
           </div>
           <span className="relative px-4 bg-screen text-xs text-muted-foreground uppercase">OR</span>
        </div>

        <div className="flex flex-col items-center mb-8">
           <button className="flex items-center gap-2 px-6 py-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-sm font-medium">Record your audio</span>
           </button>
           <p className="text-xs text-muted-foreground">10-20 seconds of speaking is advisable.</p>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Enter a name for your voice</label>
              <span className="text-xs text-muted-foreground">0/20</span>
            </div>
            <input 
              type="text" 
              placeholder="e.g. My Custom Voice"
              className="w-full bg-background border border-border rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select Language</label>
            <div className="relative">
              <select className="w-full bg-background border border-border rounded-lg px-4 py-3 outline-none appearance-none cursor-pointer focus:border-primary transition-colors">
                <option>English</option>
                <option>Chinese</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <button className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-primary/20">
             <Waveform className="w-5 h-5" />
             Clone Voice
          </button>
        </div>
      </div>
    </div>
  );
};
