const domain = "rtvox.com" as const;
const downloadPrefix = "rtvox" as const;

export const siteConfig = {
  brandName: "RTVox",
  domain,
  siteUrl: `https://${domain}`,
  supportEmail: `support@${domain}`,
  downloadPrefix,
  defaultDescription: "AI Voice Cloning and Text-to-Speech",
  voiceAvatarVariant: "orb3d",
} as const;
