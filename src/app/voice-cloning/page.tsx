import { VoiceCloningClient } from "@/components/voice-cloning-client";

export default function VoiceCloningPage() {
  const enabled = process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED === "1";
  if (!enabled) {
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
        <main className="px-5 pt-10 pb-16">
          <div className="max-w-[900px] mx-auto rounded-2xl border border-border bg-muted/20 p-6">
            <div className="text-lg font-semibold">Voice Cloning is temporarily disabled</div>
            <div className="mt-2 text-sm text-muted-foreground">
              We’re waiting for Google to enable the required voice cloning provisioning workflow. You can continue using
              Text to Speech.
            </div>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <main className="px-5 pt-6 pb-16">
        <div className="max-w-[1100px] mx-auto">
          <VoiceCloningClient />
        </div>
      </main>
    </div>
  );
}
