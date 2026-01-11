"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import { Menu, X, Github, CircleDollarSign } from "lucide-react";
import { useLocale } from "@/hooks";
import { authClient } from "@/lib/auth/client";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { locale, dictionary } = useLocale();
  const session = authClient.useSession();
  const isAuthenticated = Boolean(session.data?.user);
  const defaultTokens = 500;
  const [tokens, setTokens] = useState(defaultTokens);
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com";

  useEffect(() => {
    const controller = new AbortController();

    async function loadTokens() {
      try {
        const resp = await fetch("/api/tokens", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!resp.ok) return;
        const json = (await resp.json()) as unknown;
        const nextTokens = (json as { data?: { tokens?: unknown } })?.data?.tokens;
        if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
          setTokens(nextTokens);
          window.dispatchEvent(new CustomEvent("tokens:update", { detail: { tokens: nextTokens } }));
        }
      } catch {
        // ignore
      }
    }

    loadTokens();

    return () => controller.abort();
  }, [isAuthenticated]);

  useEffect(() => {
    function handleTokensUpdate(event: Event) {
      const nextTokens = (event as CustomEvent<{ tokens?: unknown }>).detail?.tokens;
      if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
        setTokens(nextTokens);
      }
    }

    window.addEventListener("tokens:update", handleTokensUpdate as EventListener);
    return () => window.removeEventListener("tokens:update", handleTokensUpdate as EventListener);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center flex-1">
          <Link href={locale === 'en' ? '/' : `/${locale}/`} className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              RTVox
            </span>
          </Link>
        </div>

        {/* 功能特征，价格方案，blog， 文档 */}
        <nav className="hidden md:flex items-center space-x-8 absolute left-1/2 -translate-x-1/2">
          <Link
            href={locale === 'en' ? '/features' : `/${locale}/features`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
          >
            {dictionary.header.features}
          </Link>
          <Link
            href={locale === 'en' ? '/pricing' : `/${locale}/pricing`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
          >
            {dictionary.header.pricing}
          </Link>
          <Link
            href={locale === 'en' ? '/blogs' : `/${locale}/blogs`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
          >
            Blog
          </Link>
          <Link
            href={locale === 'en' ? '/docs' : `/${locale}/docs`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
          >
            {dictionary.header.docs}
          </Link>
        </nav>

	        {/* Desktop CTA */}
	        <div className="hidden md:flex items-center space-x-2 flex-1 justify-end">
	          <div
	            className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
	            aria-label="Tokens"
	            title="Tokens"
	          >
	            <CircleDollarSign className="h-5 w-5" />
	            <span className="text-xs font-semibold tabular-nums">{tokens}</span>
	          </div>
	          <a
	            href={githubUrl}
	            target="_blank"
	            rel="noopener noreferrer"
	            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
	            aria-label="GitHub"
	          >
	            <Github className="h-5 w-5" />
	          </a>
	          <LanguageSwitcher currentLocale={locale} triggerId="header-language-desktop" />
	          <ThemeSwitcher dictionary={dictionary.header} triggerId="header-theme-desktop" />
	          {isAuthenticated ? (
            <UserMenu dictionary={dictionary.header} locale={locale} triggerId="header-user-menu-desktop" />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href={locale === 'en' ? '/login' : `/${locale}/login`}>
                  {dictionary.header.login}
                </Link>
              </Button>
              <Button asChild>
                <Link href={locale === 'en' ? '/signup' : `/${locale}/signup`}>
                  {dictionary.header.signup}
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="px-4 py-6 space-y-4">
            <Link
              href={locale === 'en' ? '/features' : `/${locale}/features`}
              className="block text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {dictionary.header.features}
            </Link>
            <Link
              href={locale === 'en' ? '/pricing' : `/${locale}/pricing`}
              className="block text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {dictionary.header.pricing}
            </Link>
            <Link
              href={locale === 'en' ? '/blogs' : `/${locale}/blogs`}
              className="block text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              href={locale === 'en' ? '/docs' : `/${locale}/docs`}
              className="block text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {dictionary.header.docs}
            </Link>
            
	            {/* 移动端切换按钮 */}
	            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
	              <div className="flex items-center gap-2">
	                <div
	                  className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
	                  aria-label="Tokens"
	                  title="Tokens"
	                >
	                  <CircleDollarSign className="h-5 w-5" />
	                  <span className="text-xs font-semibold tabular-nums">{tokens}</span>
	                </div>
	                <a
	                  href={githubUrl}
	                  target="_blank"
	                  rel="noopener noreferrer"
	                  className="inline-flex items-center justify-center space-x-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 flex-1"
	                  onClick={() => setIsMenuOpen(false)}
	                >
	                  <Github className="h-5 w-5" />
	                  <span>GitHub</span>
	                </a>
	                <LanguageSwitcher currentLocale={locale} triggerId="header-language-mobile" />
	                <ThemeSwitcher dictionary={dictionary.header} triggerId="header-theme-mobile" />
	              </div>
	            </div>
            
            {/* 移动端用户菜单 */}
            <div className="pt-4 space-y-3">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                    <UserMenu dictionary={dictionary.header} locale={locale} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {session.data?.user?.name || "用户"}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {session.data?.user?.email}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" asChild className="flex-1">
                    <Link
                      href={locale === 'en' ? '/login' : `/${locale}/login`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {dictionary.header.login}
                    </Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link
                      href={locale === 'en' ? '/signup' : `/${locale}/signup`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {dictionary.header.signup}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
