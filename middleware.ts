import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultLocale, locales } from "@/i18n/types";

const LOCALE_COOKIE = "rtvox_locale";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect well-known icon paths to the public asset host (R2 custom domain).
  // Browsers may request these directly, ignoring <link rel="icon">.
  if (pathname === "/favicon.ico" || pathname === "/apple-touch-icon.png") {
    const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim();
    if (base) {
      const target =
        pathname === "/apple-touch-icon.png"
          ? `${base.replace(/\/$/, "")}/photo/text-to-speech.png`
          : `${base.replace(/\/$/, "")}/photo/text-to-speech.ico`;
      return NextResponse.redirect(target);
    }
  }

  const savedLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const preferredLocale =
    typeof savedLocale === "string" && (locales as readonly string[]).includes(savedLocale)
      ? (savedLocale as (typeof locales)[number])
      : defaultLocale;

  // Keep default-locale URLs clean (e.g. /en/pricing -> /pricing), but only when the user prefers default locale.
  if (
    preferredLocale === defaultLocale &&
    (pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`))
  ) {
    const nextPathname = pathname.replace(`/${defaultLocale}`, "") || "/";
    const url = request.nextUrl.clone();
    url.pathname = nextPathname;
    return NextResponse.redirect(url);
  }

  // Check if the path is missing a locale prefix.
  const pathnameIsMissingLocale = locales.every(
    (loc) => pathname !== `/${loc}` && !pathname.startsWith(`/${loc}/`),
  );

  // If missing, rewrite to the default locale version (without redirect).
  if (pathnameIsMissingLocale) {
    if (preferredLocale === defaultLocale) {
      // Keep URL clean for default locale.
      return NextResponse.rewrite(new URL(`/${defaultLocale}${pathname}`, request.url));
    }

    // For non-default locale, redirect so the URL includes the locale prefix (client-side locale detection works).
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const segments = pathname.split("/").filter(Boolean);
  const activeLocale = segments[0];
  const res = NextResponse.next();

  // If the user has no locale cookie yet, persist the locale from the URL.
  if (!request.cookies.get(LOCALE_COOKIE) && activeLocale && (locales as readonly string[]).includes(activeLocale)) {
    res.cookies.set(LOCALE_COOKIE, activeLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return res;
}

export const config = {
  matcher: [
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/((?!api|admin|_next/static|_next/image|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
