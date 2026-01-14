import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

export const runtime = "edge";

const size = { width: 1200, height: 630 };

function clampText(input: string, max: number) {
  const trimmed = input.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const title = clampText(searchParams.get("title") ?? siteConfig.brandName, 60);
  const subtitle = clampText(searchParams.get("subtitle") ?? siteConfig.defaultDescription, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#050507",
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(59,130,246,0.35), transparent 60%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(circle at 50% 90%, rgba(236,72,153,0.20), transparent 60%)",
          color: "#ffffff",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            />
            <div style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em" }}>{siteConfig.brandName}</div>
          </div>
          <div
            style={{
              fontSize: "18px",
              padding: "10px 14px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {siteConfig.domain}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: "64px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.06 }}>
            {title}
          </div>
          <div style={{ fontSize: "28px", lineHeight: 1.25, color: "rgba(255,255,255,0.80)" }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {["Text to Speech", "Credits", "Podcast MVP"].map((label) => (
            <div
              key={label}
              style={{
                fontSize: "18px",
                padding: "10px 14px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.88)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

