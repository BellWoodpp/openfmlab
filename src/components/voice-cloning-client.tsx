"use client";

import dynamic from "next/dynamic";
import { VoiceCloningSkeleton } from "@/components/voice-cloning-skeleton";

const VoiceCloningPanel = dynamic(() => import("@/components/VoiceCloningPanel"), {
  ssr: false,
  loading: () => <VoiceCloningSkeleton />,
});

export function VoiceCloningClient({ onGoToTts }: { onGoToTts?: () => void }) {
  return <VoiceCloningPanel onGoToTts={onGoToTts} />;
}

