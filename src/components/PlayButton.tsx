import React, { useEffect, useState, useRef } from "react";
import { Play } from "./ui/Icons";
import { Button } from "./ui/button";
import { appStore } from "@/lib/store";
import s from "./ui/Footer.module.css";

const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const PlayingWaveform = ({
  audioLoaded,
  amplitudeLevels,
}: {
  audioLoaded: boolean;
  amplitudeLevels: number[];
}) => (
  <div className="w-[36px] h-[16px] relative left-[4px]">
    {amplitudeLevels.map((level, idx) => {
      const height = `${Math.min(Math.max(level * 30, 0.2), 1.9) * 100}%`;
      return (
        <div
          key={idx}
          className={`w-[2px] bg-white transition-all duration-150 rounded-[2px] absolute top-1/2 -translate-y-1/2 ${
            audioLoaded ? "opacity-100" : s["animate-wave"]
          }`}
          style={{
            height,
            animationDelay: `${idx * 0.15}s`,
            left: `${idx * 6}px`,
          }}
        />
      );
    })}
  </div>
);

export default function PlayButton() {
  const inputValue = appStore.useState((s) => s.input);
  const playbackRate = appStore.useState((s) => s.playbackRate);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [amplitudeLevels, setAmplitudeLevels] = useState<number[]>(
    new Array(5).fill(0)
  );
  const amplitudeIntervalRef = useRef<number | null>(null);
  const useStaticAnimation = IS_SAFARI || IS_IOS;

  useEffect(() => {
    if (!audioRef.current) return;
    const next = Number.isFinite(playbackRate) ? playbackRate : 1;
    audioRef.current.defaultPlaybackRate = next;
    audioRef.current.playbackRate = next;
  }, [playbackRate]);

  const generateRandomAmplitudes = () =>
    Array(5)
      .fill(0)
      .map(() => Math.random() * 0.06);

  const handleSubmit = async () => {
    const { input, voice, tone, speakingRateMode, speakingRate, volumeGainDb } = appStore.getState();

    if (audioLoading) return;
    if (!input.trim()) {
      alert("Please enter text to generate speech.");
      return;
    }

    // toggle off if already playing
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setAudioLoaded(false);
      audioRef.current = null;
      if (amplitudeIntervalRef.current) {
        clearInterval(amplitudeIntervalRef.current);
        amplitudeIntervalRef.current = null;
      }
      return;
    }

    setAudioLoading(true);
    appStore.setState({ latestAudioId: null, latestAudioUrl: null, latestAudioBlobUrl: null });

    try {
      const metaUrl = new URL("/api/tts/meta", window.location.origin);
      metaUrl.searchParams.set("voice", voice);
      metaUrl.searchParams.set("format", "mp3");
      metaUrl.searchParams.set("tone", tone);
      metaUrl.searchParams.set("volumeGainDb", String(volumeGainDb));
      if (speakingRateMode === "custom" && Math.abs(speakingRate - 1) > 1e-6) {
        metaUrl.searchParams.set("speakingRate", String(speakingRate));
      }

      fetch(metaUrl.toString())
        .then((res) => (res.ok ? res.json() : null))
        .then((meta) => {
          if (meta) console.info("[TTS meta]", meta);
        })
        .catch(() => {});

      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          voice,
          tone,
          speakingRateMode,
          speakingRate,
          volumeGainDb,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please sign in to generate and save audio history.");
        }
        const details = await res.text().catch(() => "");
        throw new Error(details || "Error generating audio");
      }

      const data = (await res.json()) as { id: string; audioUrl: string; createdAt?: string | null };
      const audioPath = data.audioUrl;
      const audioUrl = audioPath.startsWith("http") ? audioPath : audioPath;

      appStore.setState((draft) => {
        draft.latestAudioId = data.id;
        draft.latestAudioUrl = audioUrl;
        draft.latestAudioBlobUrl = audioUrl;
        const createdAt = data.createdAt ?? new Date().toISOString();
        draft.ttsHistory = [
          { id: data.id, createdAt, voice, tone, audioUrl },
          ...draft.ttsHistory.filter((it) => it.id !== data.id),
        ];
      });

      // reset any old sampler
      if (amplitudeIntervalRef.current !== null) {
        clearInterval(amplitudeIntervalRef.current);
        amplitudeIntervalRef.current = null;
      }

      const audio = new Audio();
      audio.preload = "none";
      audio.defaultPlaybackRate = playbackRate;
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      // for non‑iOS/Safari, hook up WebAudio analyzer
      if (!useStaticAnimation) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
      }

      const sample = () => {
        if (useStaticAnimation) {
          setAmplitudeLevels(generateRandomAmplitudes());
          return;
        }
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(data);
        const avg =
          data.reduce((sum, v) => sum + Math.abs(v - 128), 0) /
          analyserRef.current.fftSize;
        const amp = avg / 128;
        setAmplitudeLevels((prev) => [...prev.slice(1), amp]);
      };

      audio.onerror = () => {
        setAudioLoading(false);
        setAudioLoaded(false);
        setIsPlaying(false);
        alert("Error generating audio");
      };

      audio.onplay = () => {
        amplitudeIntervalRef.current = window.setInterval(sample, 100);
        setIsPlaying(true);
        setAudioLoaded(true);
        setAudioLoading(false);
      };

      const clearSampling = () => {
        audioRef.current = null;
        if (amplitudeIntervalRef.current !== null) {
          clearInterval(amplitudeIntervalRef.current);
          amplitudeIntervalRef.current = null;
        }
        setIsPlaying(false);
      };

      audio.onpause = clearSampling;
      audio.onended = clearSampling;
      audio.autoplay = true;
      audio.src = audioUrl;
    } catch (err) {
      console.error("Error generating speech:", err);
      setAudioLoading(false);
      setAudioLoaded(false);
      setIsPlaying(false);
      alert(err instanceof Error ? err.message : "Error generating audio");
    }
  };

  return (
    <Button
      color="primary"
      onClick={handleSubmit}
      selected={audioLoading || isPlaying}
      className="relative"
      disabled={!inputValue.trim()}
    >
      {isPlaying ? (
        <PlayingWaveform
          audioLoaded={audioLoaded}
          amplitudeLevels={amplitudeLevels}
        />
      ) : audioLoading ? (
        <PlayingWaveform
          audioLoaded={false}
          amplitudeLevels={[0.032, 0.032, 0.032, 0.032, 0.032]}
        />
      ) : (
        <Play />
      )}
      <span className="uppercase hidden md:inline pr-3">
        {isPlaying ? "Stop" : audioLoading ? "Busy" : "Play"}
      </span>
    </Button>
  );
}
