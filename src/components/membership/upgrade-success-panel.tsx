"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/types";
import { defaultLocale } from "@/i18n/types";
import { resolveIntlNumberLocale } from "@/i18n/locale-config";

type Copy = {
  title: string;
  subtitle: string;
  tokensTitle: string;
  tokensSubtitle: string;
  tokensBefore: string;
  tokensAdded: string;
  tokensAfter: string;
  loading: string;
  useProduct: string;
  viewMembership: string;
  viewOrders: string;
};

function getCopy(locale: Locale): Copy {
  const map: Partial<Record<Locale, Partial<Copy>>> & { en: Copy } = {
    en: {
      title: "Upgrade successful",
      subtitle: "Your billing period is now yearly.",
      tokensTitle: "Token update",
      tokensSubtitle: "Your token balance after the upgrade.",
      tokensBefore: "Before",
      tokensAdded: "Added",
      tokensAfter: "Now",
      loading: "Loading...",
      useProduct: "Use product now",
      viewMembership: "Go to membership",
      viewOrders: "View orders",
    },
    zh: {
      title: "升级成功",
      subtitle: "你的会员计费周期已升级为年付。",
      tokensTitle: "积分变动",
      tokensSubtitle: "展示本次升级前后你的积分变化。",
      tokensBefore: "原有积分",
      tokensAdded: "新增积分",
      tokensAfter: "当前积分",
      loading: "载入中...",
      useProduct: "立即使用产品",
      viewMembership: "返回会员中心",
      viewOrders: "查看订单",
    },
    ja: {
      title: "アップグレード完了",
      subtitle: "請求周期が年額になりました。",
      tokensTitle: "トークン更新",
      tokensSubtitle: "アップグレード後のトークン残高です。",
      tokensBefore: "変更前",
      tokensAdded: "増加分",
      tokensAfter: "現在",
      loading: "読み込み中...",
      useProduct: "今すぐ使う",
      viewMembership: "メンバーシップへ",
      viewOrders: "注文を見る",
    },
    es: {
      title: "Upgrade completado",
      subtitle: "Tu facturación ahora es anual.",
      tokensTitle: "Actualización de tokens",
      tokensSubtitle: "Tu saldo de tokens tras el upgrade.",
      tokensBefore: "Antes",
      tokensAdded: "Añadidos",
      tokensAfter: "Ahora",
      loading: "Cargando...",
      useProduct: "Usar ahora",
      viewMembership: "Ir a membresía",
      viewOrders: "Ver pedidos",
    },
    ar: {
      title: "تمت الترقية بنجاح",
      subtitle: "أصبحت فترة الفوترة سنوية الآن.",
      tokensTitle: "تحديث النقاط",
      tokensSubtitle: "رصيد النقاط بعد الترقية.",
      tokensBefore: "قبل",
      tokensAdded: "المضاف",
      tokensAfter: "الآن",
      loading: "جارٍ التحميل...",
      useProduct: "استخدم المنتج الآن",
      viewMembership: "العودة للعضوية",
      viewOrders: "عرض الطلبات",
    },
    id: {
      title: "Upgrade berhasil",
      subtitle: "Periode penagihan Anda sekarang tahunan.",
      tokensTitle: "Perubahan token",
      tokensSubtitle: "Saldo token Anda setelah upgrade.",
      tokensBefore: "Sebelum",
      tokensAdded: "Ditambah",
      tokensAfter: "Sekarang",
      loading: "Memuat...",
      useProduct: "Gunakan sekarang",
      viewMembership: "Ke membership",
      viewOrders: "Lihat pesanan",
    },
    pt: {
      title: "Upgrade concluído",
      subtitle: "Sua cobrança agora é anual.",
      tokensTitle: "Atualização de tokens",
      tokensSubtitle: "Seu saldo de tokens após o upgrade.",
      tokensBefore: "Antes",
      tokensAdded: "Adicionados",
      tokensAfter: "Agora",
      loading: "Carregando...",
      useProduct: "Usar agora",
      viewMembership: "Ir para membership",
      viewOrders: "Ver pedidos",
    },
    fr: {
      title: "Mise à niveau réussie",
      subtitle: "Votre facturation est désormais annuelle.",
      tokensTitle: "Mise à jour des tokens",
      tokensSubtitle: "Votre solde de tokens après la mise à niveau.",
      tokensBefore: "Avant",
      tokensAdded: "Ajoutés",
      tokensAfter: "Maintenant",
      loading: "Chargement...",
      useProduct: "Utiliser maintenant",
      viewMembership: "Aller à l’abonnement",
      viewOrders: "Voir les commandes",
    },
    ru: {
      title: "Апгрейд выполнен",
      subtitle: "Период оплаты теперь годовой.",
      tokensTitle: "Изменение токенов",
      tokensSubtitle: "Ваш баланс токенов после апгрейда.",
      tokensBefore: "Было",
      tokensAdded: "Добавлено",
      tokensAfter: "Стало",
      loading: "Загрузка...",
      useProduct: "Начать пользоваться",
      viewMembership: "Перейти в подписку",
      viewOrders: "Заказы",
    },
    de: {
      title: "Upgrade erfolgreich",
      subtitle: "Dein Abrechnungszeitraum ist jetzt jährlich.",
      tokensTitle: "Token-Update",
      tokensSubtitle: "Dein Token-Stand nach dem Upgrade.",
      tokensBefore: "Vorher",
      tokensAdded: "Hinzugefügt",
      tokensAfter: "Jetzt",
      loading: "Lädt...",
      useProduct: "Jetzt nutzen",
      viewMembership: "Zur Mitgliedschaft",
      viewOrders: "Bestellungen",
    },
  };

  return { ...map.en, ...(map[locale] ?? {}) };
}

function parseIntSafe(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value !== "string") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

export function UpgradeSuccessPanel({ locale }: { locale: Locale }) {
  const t = useMemo(() => getCopy(locale), [locale]);
  const [tokensAfter, setTokensAfter] = useState<number | null>(null);
  const [tokensBefore, setTokensBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const intl = useMemo(() => new Intl.NumberFormat(resolveIntlNumberLocale(locale)), [locale]);

  const membershipHref = locale === defaultLocale ? "/membership" : `/${locale}/membership`;
  const ordersHref = locale === defaultLocale ? "/orders" : `/${locale}/orders`;
  const podcastHref = locale === defaultLocale ? "/podcast-mvp" : `/${locale}/podcast-mvp`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        let before: number | null = null;
        try {
          const raw = window.sessionStorage.getItem("upgrade_tokens_before");
          if (raw) before = parseIntSafe(raw);
        } catch {
          // ignore
        }

        const resp = await fetch("/api/tokens", { cache: "no-store" });
        const json = (await resp.json().catch(() => null)) as { ok?: boolean; data?: { tokens?: unknown } } | null;
        const after = parseIntSafe(json?.data?.tokens);

        if (!cancelled) {
          setTokensBefore(before);
          setTokensAfter(after);
        }
      } catch {
        if (!cancelled) {
          setTokensBefore(null);
          setTokensAfter(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const added = tokensBefore !== null && tokensAfter !== null ? tokensAfter - tokensBefore : null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader>
                <CardTitle className="text-base">{t.tokensTitle}</CardTitle>
                <CardDescription>{t.tokensSubtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-sm text-neutral-600 dark:text-neutral-300">{t.loading}</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{t.tokensBefore}</div>
                      <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {tokensBefore === null ? "—" : intl.format(tokensBefore)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{t.tokensAdded}</div>
                      <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {added === null ? "—" : intl.format(added)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{t.tokensAfter}</div>
                      <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {tokensAfter === null ? "—" : intl.format(tokensAfter)}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href={podcastHref}>{t.useProduct}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={membershipHref}>{t.viewMembership}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={ordersHref}>{t.viewOrders}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
