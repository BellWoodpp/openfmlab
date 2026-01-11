export type VoiceAvatarVariant = "orb3d" | "gradient" | "flat";

type AvatarOptions = {
  size?: number;
  variant?: VoiceAvatarVariant;
};

const avatarCache = new Map<string, string>();

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function base64EncodeUtf8(input: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(input, "utf8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(input)));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function voiceAvatarDataUri(seed: string, opts: AvatarOptions = {}): string {
  const normalizedSeed = seed.trim() || "voice";
  const size = clamp(Math.floor(opts.size ?? 80), 40, 256);
  const variant: VoiceAvatarVariant = opts.variant ?? "orb3d";
  const cacheKey = `${normalizedSeed}::${variant}::${size}`;
  const cached = avatarCache.get(cacheKey);
  if (cached) return cached;

  const hash = hashString(normalizedSeed);
  const hue1 = mod(hash, 360);
  const hue2 = mod(hue1 + 55 + ((hash >>> 8) % 120), 360);
  const hue3 = mod(hue1 + 190 + ((hash >>> 16) % 80), 360);

  const accent = hash % 3; // 0/1/2
  const faceType = (hash >>> 20) % 3; // 0/1/2

  const bg1 = `hsl(${hue1} 85% 60%)`;
  const bg2 = `hsl(${hue2} 85% 46%)`;
  const orb1 = `hsl(${hue3} 88% 62%)`;
  const orb2 = `hsl(${hue2} 92% 40%)`;
  const detail = accent === 0 ? `hsl(${hue1} 95% 56%)` : accent === 1 ? `hsl(${hue2} 95% 56%)` : `hsl(${hue3} 95% 56%)`;

  const initial = normalizedSeed.trim().slice(0, 1).toUpperCase() || "V";

  const svg =
    variant === "gradient"
      ? `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <circle cx="40" cy="40" r="40" fill="url(#g)"/>
  <circle cx="40" cy="40" r="39" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
  <text x="40" y="46" text-anchor="middle" font-size="34" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto" font-weight="750" fill="rgba(255,255,255,0.92)">${initial}</text>
</svg>`
      : variant === "flat"
        ? `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80" shape-rendering="geometricPrecision">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="85%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="rgba(0,0,0,0.28)"/>
    </filter>
  </defs>

  <circle cx="40" cy="40" r="40" fill="url(#bg)"/>
  <circle cx="40" cy="40" r="39" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>

  <g filter="url(#shadow)">
    <circle cx="40" cy="34" r="15.5" fill="rgba(255,255,255,0.86)"/>
    <path d="M16 70 C 22 54, 32 48, 40 48 C 48 48, 58 54, 64 70" fill="rgba(255,255,255,0.86)"/>
    <circle cx="33" cy="34" r="2.1" fill="rgba(0,0,0,0.35)"/>
    <circle cx="47" cy="34" r="2.1" fill="rgba(0,0,0,0.35)"/>
    <path d="M34 41 C 37 44, 43 44, 46 41" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M18 26 L24 20 L30 26 L24 32 Z" fill="${detail}" opacity="0.55"/>
  </g>
</svg>`
        : (() => {
            const faceFill = "rgba(0,0,0,0.55)";
            const faceSoft = "rgba(0,0,0,0.35)";
            const faceX = 40;
            const faceY = 44;

            const eyeDx = faceType === 2 ? 8.5 : 9.5;
            const eyeR = faceType === 1 ? 2.2 : 2;
            const mouthPath =
              faceType === 0
                ? `M${faceX - 7} ${faceY + 7} C ${faceX - 2} ${faceY + 10}, ${faceX + 2} ${faceY + 10}, ${faceX + 7} ${faceY + 7}`
                : faceType === 1
                  ? `M${faceX - 6} ${faceY + 7} C ${faceX - 2} ${faceY + 5}, ${faceX + 2} ${faceY + 5}, ${faceX + 6} ${faceY + 7}`
                  : `M${faceX - 5.5} ${faceY + 7} C ${faceX - 1} ${faceY + 9}, ${faceX + 1} ${faceY + 9}, ${faceX + 5.5} ${faceY + 7}`;

            const accessory =
              accent === 0
                ? `<path d="M18 54 C 28 40, 52 40, 62 54" stroke="${detail}" stroke-width="6" stroke-linecap="round" opacity="0.55"/>`
                : accent === 1
                  ? `<circle cx="62" cy="26" r="5.5" fill="${detail}" opacity="0.55"/>`
                  : `<path d="M20 26 L26 20 L32 26 L26 32 Z" fill="${detail}" opacity="0.55"/>`;

            return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80" shape-rendering="geometricPrecision">
  <defs>
    <radialGradient id="bg" cx="30%" cy="25%" r="85%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </radialGradient>
    <radialGradient id="orb" cx="30%" cy="25%" r="80%">
      <stop offset="0%" stop-color="${orb1}"/>
      <stop offset="100%" stop-color="${orb2}"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="0.35" />
    </filter>
  </defs>

  <circle cx="40" cy="40" r="40" fill="url(#bg)"/>
  <circle cx="40" cy="40" r="39" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>

  <g filter="url(#shadow)">
    <circle cx="40" cy="42" r="26.5" fill="url(#orb)"/>
    <circle cx="30" cy="32" r="12" fill="rgba(255,255,255,0.20)"/>
    <circle cx="28" cy="30" r="5.5" fill="rgba(255,255,255,0.28)"/>
    ${accessory}

    <g filter="url(#soft)">
      <circle cx="${faceX - eyeDx}" cy="${faceY}" r="${eyeR}" fill="${faceFill}"/>
      <circle cx="${faceX + eyeDx}" cy="${faceY}" r="${eyeR}" fill="${faceFill}"/>
      <path d="${mouthPath}" fill="none" stroke="${faceSoft}" stroke-width="2.2" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
          })();

  const uri = `data:image/svg+xml;base64,${base64EncodeUtf8(svg)}`;
  avatarCache.set(cacheKey, uri);
  return uri;
}
