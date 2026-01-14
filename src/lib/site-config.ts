const domain = "rtvox.com" as const;
const downloadPrefix = "rtvox" as const;

export const siteConfig = {
  brandName: "RTVox",
  domain,
  siteUrl: `https://${domain}`,
  supportEmail: "stormrobin50@gmail.com",
  downloadPrefix,
  defaultDescription:
    "AI voice cloning and text-to-speech for podcasts, videos, and apps—natural voices, multilingual support, and fast audio generation.",
  voiceAvatarVariant: "orb3d",
} as const;
