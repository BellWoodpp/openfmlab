import React from "react";
import { Download } from "./ui/Icons";

// Mock Waveform SVG
const Waveform = () => (
  <svg
    viewBox="0 0 100 20"
    className="w-full h-full opacity-60"
    preserveAspectRatio="none"
  >
    <path
      d="M0 10 Q 5 5, 10 10 T 20 10 T 30 10 T 40 10 T 50 10 T 60 10 T 70 10 T 80 10 T 90 10 T 100 10"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      vectorEffect="non-scaling-stroke"
    />
    <path
      d="M5 10 L5 4 M15 10 L15 6 M25 10 L25 3 M35 10 L35 7 M45 10 L45 2 M55 10 L55 8 M65 10 L65 5 M75 10 L75 3 M85 10 L85 6 M95 10 L95 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
    <path d="M8 5v14l11-7z" />
  </svg>
);

interface AudioResultCardProps {
  title: string;
  duration: string;
  tags: string[];
}

export const AudioResultCard: React.FC<AudioResultCardProps> = ({
  title,
  duration,
  tags,
}) => {
  return (
    <div className="bg-card hover:shadow-lg transition-all duration-300 rounded-xl border border-border overflow-hidden flex flex-col group/card">
      {/* Top: Waveform & Play Button */}
      <div className="relative h-28 bg-gradient-to-b from-blue-50/50 to-transparent p-4 flex items-center justify-center text-blue-400/40">
        <div className="w-full h-14">
           <Waveform />
        </div>
        
        {/* Play Button Overlay */}
        <button className="absolute bottom-3 right-3 w-12 h-12 bg-primary hover:scale-105 active:scale-95 rounded-full flex items-center justify-center transition-all shadow-lg">
          <PlayIcon />
        </button>
      </div>

      {/* Bottom: Info & Actions */}
      <div className="p-4 flex flex-col gap-4 bg-background/50">
        <h3 className="font-medium text-sm text-foreground truncate" title={title}>
          {title}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="px-2 py-1 bg-muted/50 rounded text-[10px] text-muted-foreground font-medium">
                {tag}
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className="text-xs text-muted-foreground font-mono">{duration}</span>
            <button className="p-1.5 hover:bg-muted rounded-full transition-colors text-foreground/70">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
