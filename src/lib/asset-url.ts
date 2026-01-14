export function assetUrl(pathname: string): string {
  const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}

