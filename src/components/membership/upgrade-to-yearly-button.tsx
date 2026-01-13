"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/types";
import { defaultLocale } from "@/i18n/types";

function ChessKingIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="m6.7 18-1-1C4.35 15.682 3 14.09 3 12a5 5 0 0 1 4.95-5c1.584 0 2.7.455 4.05 1.818C13.35 7.455 14.466 7 16.05 7A5 5 0 0 1 21 12c0 2.082-1.359 3.673-2.7 5l-1 1" />
      <path d="M10 4h4" />
      <path d="M12 2v6.818" />
    </svg>
  );
}

function textByLocale(locale: Locale) {
  const label: Partial<Record<Locale, string>> = {
    en: "Upgrade to Yearly",
    zh: "升级为年付",
    ja: "年額にアップグレード",
    es: "Cambiar a anual",
    ar: "الترقية إلى سنوي",
    id: "Upgrade ke tahunan",
    pt: "Mudar para anual",
    fr: "Passer à l’annuel",
    ru: "Перейти на годовой",
    de: "Auf jährlich wechseln",
  };
  const loading: Partial<Record<Locale, string>> = {
    en: "Upgrading...",
    zh: "升级中...",
    ja: "切り替え中…",
    es: "Cambiando...",
    ar: "جارٍ الترقية...",
    id: "Memproses...",
    pt: "Alterando...",
    fr: "Changement...",
    ru: "Переключение...",
    de: "Wechsel...",
  };
  const failed: Partial<Record<Locale, string>> = {
    en: "Upgrade failed",
    zh: "升级失败",
    ja: "切り替えに失敗しました",
    es: "Error al cambiar",
    ar: "فشلت الترقية",
    id: "Gagal upgrade",
    pt: "Falha ao mudar",
    fr: "Échec du changement",
    ru: "Не удалось",
    de: "Wechsel fehlgeschlagen",
  };

  const helpAria: Partial<Record<Locale, string>> = {
    en: "How does the upgrade work?",
    zh: "月付如何升级为年付？",
    ja: "アップグレードの仕組み",
    es: "¿Cómo funciona la actualización?",
    ar: "كيف تعمل الترقية؟",
    id: "Bagaimana cara upgrade bekerja?",
    pt: "Como funciona o upgrade?",
    fr: "Comment fonctionne la mise à niveau ?",
    ru: "Как работает апгрейд?",
    de: "Wie funktioniert das Upgrade?",
  };

  const helpText: Partial<Record<Locale, string>> = {
    en: "We upgrade your existing monthly subscription to a yearly plan via Creem. The remaining time is prorated and the difference is charged immediately, without creating a second subscription.",
    zh: "我们会在 Creem 上把你现有的月付订阅直接升级为年付：按剩余周期进行折算（proration），立即结算差价，不会创建第二份订阅。",
    ja: "Creem を通じて、現在の月額サブスクを年額プランへそのままアップグレードします。残期間は按分（proration）され、差額が即時請求されます。別のサブスクは作成しません。",
    es: "Actualizamos tu suscripción mensual existente a un plan anual mediante Creem. Se prorratea el tiempo restante y se cobra la diferencia de inmediato, sin crear una segunda suscripción.",
    ar: "نقوم بترقية اشتراكك الشهري الحالي إلى خطة سنوية عبر Creem. يتم احتساب المدة المتبقية بنظام التناسب (proration) ويتم خصم الفرق فورًا دون إنشاء اشتراك ثانٍ.",
    id: "Kami meng-upgrade langganan bulanan yang ada menjadi paket tahunan lewat Creem. Sisa waktu dihitung prorata (proration) dan selisihnya ditagih segera, tanpa membuat langganan kedua.",
    pt: "Fazemos o upgrade da sua assinatura mensal existente para anual via Creem. O tempo restante é proporcional (proration) e a diferença é cobrada imediatamente, sem criar uma segunda assinatura.",
    fr: "Nous mettons à niveau votre abonnement mensuel existant vers un plan annuel via Creem. Le temps restant est proratisé (proration) et la différence est facturée immédiatement, sans créer un second abonnement.",
    ru: "Мы обновляем вашу текущую месячную подписку до годовой через Creem. Оставшееся время учитывается по прорации (proration), разница списывается сразу, без создания второй подписки.",
    de: "Wir upgraden dein bestehendes Monatsabo via Creem auf ein Jahresabo. Die verbleibende Zeit wird anteilig verrechnet (Proration) und die Differenz sofort berechnet – ohne ein zweites Abo anzulegen.",
  };

  return {
    label: label[locale] ?? label.en ?? "Upgrade to Yearly",
    loading: loading[locale] ?? loading.en ?? "Upgrading...",
    failed: failed[locale] ?? failed.en ?? "Upgrade failed",
    helpAria: helpAria[locale] ?? helpAria.en ?? "How does the upgrade work?",
    helpText: helpText[locale] ?? helpText.en ?? "We upgrade your existing subscription via Creem.",
  };
}

export function UpgradeToYearlyButton({
  locale,
  paymentProvider,
  className,
}: {
  locale: Locale;
  paymentProvider?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const t = textByLocale(locale);
  const helpText = paymentProvider === "dev" ? t.helpText : t.helpText;

  const onClick = () => {
    const href = locale === defaultLocale ? "/membership/upgrade-yearly" : `/${locale}/membership/upgrade-yearly`;
    router.push(href);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        <Button
          onClick={onClick}
          size="sm"
          className="bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-500 dark:text-neutral-950"
        >
          <ChessKingIcon className="mr-2 h-4 w-4" />
          {t.label}
        </Button>
        <span
          className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-amber-500/50 text-[10px] leading-none text-amber-700 dark:border-amber-400/60 dark:text-amber-200"
          aria-label={t.helpAria}
        >
          ?
          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-80 -translate-x-1/2 rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-700 shadow-md group-hover:block dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            {helpText}
          </span>
        </span>
      </div>
    </div>
  );
}
