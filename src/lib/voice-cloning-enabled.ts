export function isVoiceCloningEnabled(): boolean {
  const raw =
    process.env.VOICE_CLONING_ENABLED ??
    process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED ??
    "";
  return raw === "1" || raw.toLowerCase() === "true";
}

