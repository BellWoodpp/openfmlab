"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/types";
import { defaultLocale } from "@/i18n/types";

function copyByLocale(locale: Locale) {
  const isDefault = locale === defaultLocale;
  const backLabel: Partial<Record<Locale, string>> = {
    en: "Back",
    zh: "返回",
    ja: "戻る",
    es: "Volver",
    ar: "رجوع",
    id: "Kembali",
    pt: "Voltar",
    fr: "Retour",
    ru: "Назад",
    de: "Zurück",
  };
  const confirmLabel: Partial<Record<Locale, string>> = {
    en: "Confirm upgrade",
    zh: "确认升级",
    ja: "アップグレードを確定",
    es: "Confirmar actualización",
    ar: "تأكيد الترقية",
    id: "Konfirmasi upgrade",
    pt: "Confirmar upgrade",
    fr: "Confirmer la mise à niveau",
    ru: "Подтвердить",
    de: "Upgrade bestätigen",
  };
  const confirmingLabel: Partial<Record<Locale, string>> = {
    en: "Upgrading...",
    zh: "升级中...",
    ja: "切り替え中…",
    es: "Actualizando...",
    ar: "جارٍ الترقية...",
    id: "Memproses...",
    pt: "Atualizando...",
    fr: "Mise à niveau...",
    ru: "Обновление...",
    de: "Upgrade läuft...",
  };
  const pendingFallbackLabel: Partial<Record<Locale, string>> = {
    en: "Upgrade requested, but Creem hasn't confirmed the proration charge yet. Please check your transactions and try again later.",
    zh: "已请求升级，但 Creem 暂未确认差额扣款。请检查交易记录，稍后再试。",
    ja: "アップグレードはリクエストされましたが、Creem が差額請求をまだ確定していません。取引履歴を確認して、しばらくしてから再試行してください。",
    es: "Upgrade solicitado, pero Creem aún no confirmó el cargo prorrateado. Revisa tus transacciones e inténtalo de nuevo más tarde.",
    ar: "تم طلب الترقية، لكن Creem لم يؤكد خصم الفروقات بعد. راجع معاملاتك وحاول لاحقًا.",
    id: "Upgrade sudah diminta, namun Creem belum mengonfirmasi biaya prorata. Periksa transaksi Anda dan coba lagi nanti.",
    pt: "Upgrade solicitado, mas a Creem ainda não confirmou a cobrança proporcional. Verifique suas transações e tente novamente mais tarde.",
    fr: "Mise à niveau demandée, mais Creem n’a pas encore confirmé la facturation prorata. Vérifiez vos transactions et réessayez plus tard.",
    ru: "Запрос на апгрейд отправлен, но Creem ещё не подтвердил списание по прорации. Проверьте транзакции и попробуйте позже.",
    de: "Upgrade angefordert, aber Creem hat die Prorationsbelastung noch nicht bestätigt. Prüfe deine Transaktionen und versuche es später erneut.",
  };

  return {
    back: backLabel[locale] ?? backLabel.en ?? "Back",
    confirm: confirmLabel[locale] ?? confirmLabel.en ?? "Confirm upgrade",
    confirming: confirmingLabel[locale] ?? confirmingLabel.en ?? "Upgrading...",
    pendingFallback: pendingFallbackLabel[locale] ?? pendingFallbackLabel.en ?? "Upgrade pending.",
    backHref: isDefault ? "/membership" : `/${locale}/membership`,
  };
}

export function UpgradeYearlyConfirm({
  locale,
  paymentProvider,
  disabled,
}: {
  locale: Locale;
  paymentProvider: string | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const t = useMemo(() => copyByLocale(locale), [locale]);

  const onConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const tokensResp = await fetch("/api/tokens", { cache: "no-store" });
        const tokensJson = (await tokensResp.json().catch(() => null)) as
          | { ok?: boolean; data?: { tokens?: unknown } }
          | null;
        const tokens = tokensJson?.data?.tokens;
        if (typeof tokens === "number" && Number.isFinite(tokens)) {
          window.sessionStorage.setItem("upgrade_tokens_before", String(Math.floor(tokens)));
        }
      } catch {
        // ignore
      }

      if (paymentProvider === "dev") {
        if (process.env.NODE_ENV === "production") {
          setError("Dev provider is not available in production.");
          return;
        }
        const resp = await fetch("/api/dev/set-paid?paid=1&period=yearly", { cache: "no-store" });
        const json = (await resp.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!resp.ok || json?.ok === false) {
          setError(json?.error || "Upgrade failed");
          return;
        }
        router.push(t.backHref);
        router.refresh();
        return;
      }

      const resp = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "professional", period: "yearly", locale }),
      });
      const json = (await resp.json().catch(() => null)) as
        | {
            ok: boolean;
            message?: string;
            data?: {
              action?: "upgrade_pending" | "upgraded" | string;
              message?: string;
              redirect_url?: string;
              checkout_url?: string;
            };
          }
        | null;

      if (!resp.ok || !json?.ok) {
        setError(json?.message || "Upgrade failed");
        return;
      }

      const action = json.data?.action;
      if (action === "upgrade_pending") {
        const msg = json.data?.message || json.message || t.pendingFallback;
        setNotice(msg);
        try {
          window.sessionStorage.setItem("upgrade_pending_message", msg);
        } catch {
          // ignore
        }
        router.push(`${t.backHref}?upgrade=pending`);
        router.refresh();
        return;
      }

      const checkoutUrl = json.data?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      const redirectUrl = json.data?.redirect_url;
      if (redirectUrl) {
        const successHref = locale === defaultLocale ? "/membership/upgrade-success" : `/${locale}/membership/upgrade-success`;
        router.push(successHref);
        router.refresh();
        return;
      }

      router.push(t.backHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upgrade failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(t.backHref)} disabled={loading}>
          {t.back}
        </Button>
        <Button type="button" onClick={onConfirm} disabled={disabled || loading}>
          {loading ? t.confirming : t.confirm}
        </Button>
      </div>
      {notice ? <div className="text-xs text-amber-700 dark:text-amber-400">{notice}</div> : null}
      {error ? <div className="text-xs text-red-600 dark:text-red-400">{error}</div> : null}
    </div>
  );
}
