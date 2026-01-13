import { useState } from "react";
import { useCopiedDelay } from "@/hooks/useCopiedDelay";
import { copyText } from "../lib/copyText";
import { appStore } from "@/lib/store";
import { Share } from "./ui/Icons";
import { Button } from "./ui/button";
import ShareDialog from "./ShareDialog";
import { useLocale } from "@/hooks";

export const ShareButton = ({ generationId }: { generationId?: string | null }) => {
  const { locale } = useLocale();
  const { copied, trigger } = useCopiedDelay();
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const latestAudioId = appStore.useState((s) => s.latestAudioId);
  const resolvedGenerationId = generationId ?? latestAudioId;
  const label = (
    {
      en: "Share",
      zh: "分享",
      ja: "共有",
      es: "Compartir",
      ar: "مشاركة",
      id: "Bagikan",
      pt: "Compartilhar",
      fr: "Partager",
      ru: "Поделиться",
      de: "Teilen",
    } as const
  )[locale] ?? "Share";
  const handleShare = async () => {
    const id = resolvedGenerationId;
    if (!id) {
      alert("Click Play to generate audio first.");
      return;
    }

    try {
      const res = await fetch("/api/tts/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ generationId: id }),
      });
      if (!res.ok) {
        const details = await res.text().catch(() => "");
        alert(details || "Error sharing. Please try again.");
        return;
      }
      const data = await res.json();
      const shareUrl = `${window.location.origin}${data.url}`;
      // Copy share URL to clipboard to share with others.
      await copyText(shareUrl);
      setShareUrl(shareUrl);
      setOpen(true);
    } catch (err) {
      console.error("Error creating share link:", err);
      alert("Error creating share link. Please try again.");
    }
  };

  return (
    <>
      <Button
        color="secondary"
        onClick={() => {
          if (copied) return;
          trigger();
          handleShare();
        }}
        disabled={!resolvedGenerationId}
      >
        <span className="flex gap-2 items-center justify-center">
          <Share />
          <span className="uppercase hidden md:inline pr-3">{label}</span>
        </span>
      </Button>
      <ShareDialog shareUrl={shareUrl} open={open} onOpenChange={setOpen} />
    </>
  );
};
