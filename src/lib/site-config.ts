const domain = "rtvox.com" as const;
const downloadPrefix = "rtvox" as const;

export const siteConfig = {
  brandName: "RTVox",
  domain,
  siteUrl: `https://${domain}`,
  supportEmail: "stormrobin50@gmail.com",
  downloadPrefix,
  defaultDescription:
    "AI voice cloning and text-to-speech for podcasts, videos, and apps. Natural voices, multilingual support, fast generation, low latency, and easy integration.",
  voiceAvatarVariant: "orb3d",
} as const;
