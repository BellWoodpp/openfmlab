import React, { useRef, useState } from "react";
import { Download } from "./ui/Icons";
import { Button } from "./ui/button";
import { appStore } from "@/lib/store";

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
            audioLoaded ? "opacity-100" : "animate-wave"
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

export default function DownloadButton() {
  const latestAudioBlobUrl = appStore.useState((s) => s.latestAudioBlobUrl);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const { voice } = appStore.getState();
    if (!latestAudioBlobUrl) {
      alert("Click Play to generate audio first.");
      return;
    }

    const vibe = "audio";
    const filename = `voiceslab-${voice}-${vibe}.mp3`;

    setLoading(true);
    try {
      const link = document.createElement("a");
      link.href = latestAudioBlobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error downloading audio:", err);
      alert(err instanceof Error ? err.message : "Error downloading audio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      color="tertiary"
      onClick={handleDownload}
      disabled={loading || !latestAudioBlobUrl}
    >
      {loading ? (
        <PlayingWaveform
          audioLoaded={false}
          amplitudeLevels={[0.04, 0.04, 0.04, 0.04, 0.04]}
        />
      ) : (
        <Download />
      )}{" "}
      <span className="uppercase hidden md:inline pr-3">Download</span>
    </Button>
  );
}
