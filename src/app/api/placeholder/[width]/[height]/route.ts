import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ width: string; height: string }> },
) {
  const { width, height } = await context.params;

  const safeWidth = Math.max(1, Math.min(4000, Number.parseInt(width, 10) || 400));
  const safeHeight = Math.max(1, Math.min(4000, Number.parseInt(height, 10) || 300));

  const svg = `
    <svg width="${safeWidth}" height="${safeHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" font-weight="bold"
            text-anchor="middle" dominant-baseline="middle" fill="white">
        ${safeWidth}×${safeHeight}
      </text>
    </svg>
  `;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000",
    },
  });
}

