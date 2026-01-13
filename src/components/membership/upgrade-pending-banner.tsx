"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/types";
import { defaultLocale } from "@/i18n/types";

type Copy = {
  title: string;
  description: string;
  hint: string;
  refreshNow: string;
  viewOrders: string;
  dismiss: string;
  checking: string;
  timedOut: string;
};

function getCopy(locale: Locale): Copy {
  const copy: Partial<Record<Locale, Partial<Copy>>> & { en: Copy } = {
    en: {
      title: "Confirming yearly upgrade…",
      description: "We requested the upgrade. Creem may take a moment to confirm the prorated charge.",
      hint: "If it stays pending, open your latest order and click “Refresh Status”, or check Creem → Transactions.",
      refreshNow: "Refresh now",
      viewOrders: "View orders",
      dismiss: "Dismiss",
      checking: "Checking status…",
      timedOut: "Still pending. Please try “Refresh Status” from your latest order.",
    },
    zh: {
      title: "正在确认年付升级…",
      description: "我们已发起升级请求。Creem 可能需要一点时间确认差额扣款（proration）。",
      hint: "如果长时间未完成，请打开最近订单点击「Refresh Status」，或在 Creem 后台查看 Transactions。",
      refreshNow: "立即刷新",
      viewOrders: "查看订单",
      dismiss: "关闭",
      checking: "正在检查状态…",
      timedOut: "仍在确认中，请在最近订单里点「Refresh Status」再试。",
    },
    ja: {
      title: "年額アップグレードを確認中…",
      description: "アップグレードをリクエストしました。Creem が差額請求（proration）を確定するまで少し時間がかかる場合があります。",
      hint: "長時間変わらない場合は、最新の注文で「Refresh Status」を押すか、Creem → Transactions を確認してください。",
      refreshNow: "今すぐ更新",
      viewOrders: "注文を見る",
      dismiss: "閉じる",
      checking: "状態を確認中…",
      timedOut: "まだ保留中です。最新の注文から「Refresh Status」を試してください。",
    },
    es: {
      title: "Confirmando upgrade anual…",
      description: "Solicitamos el upgrade. Creem puede tardar un poco en confirmar el cargo prorrateado.",
      hint: "Si sigue pendiente, abre tu último pedido y pulsa “Refresh Status”, o revisa Creem → Transactions.",
      refreshNow: "Actualizar ahora",
      viewOrders: "Ver pedidos",
      dismiss: "Cerrar",
      checking: "Comprobando estado…",
      timedOut: "Aún pendiente. Prueba “Refresh Status” en tu último pedido.",
    },
    ar: {
      title: "جارٍ تأكيد الترقية السنوية…",
      description: "تم إرسال طلب الترقية. قد تستغرق Creem بعض الوقت لتأكيد رسوم الفروقات (proration).",
      hint: "إذا بقيت معلّقة، افتح أحدث طلب واضغط “Refresh Status”، أو راجع Creem → Transactions.",
      refreshNow: "تحديث الآن",
      viewOrders: "عرض الطلبات",
      dismiss: "إغلاق",
      checking: "جارٍ التحقق من الحالة…",
      timedOut: "ما زالت معلّقة. جرّب “Refresh Status” من أحدث طلب.",
    },
    id: {
      title: "Mengonfirmasi upgrade tahunan…",
      description: "Kami sudah meminta upgrade. Creem mungkin butuh waktu untuk mengonfirmasi biaya prorata.",
      hint: "Jika masih pending, buka pesanan terbaru lalu klik “Refresh Status”, atau cek Creem → Transactions.",
      refreshNow: "Refresh sekarang",
      viewOrders: "Lihat pesanan",
      dismiss: "Tutup",
      checking: "Memeriksa status…",
      timedOut: "Masih pending. Coba “Refresh Status” di pesanan terbaru.",
    },
    pt: {
      title: "Confirmando upgrade anual…",
      description: "Solicitamos o upgrade. A Creem pode levar um momento para confirmar a cobrança proporcional.",
      hint: "Se continuar pendente, abra o pedido mais recente e clique em “Refresh Status”, ou verifique Creem → Transactions.",
      refreshNow: "Atualizar agora",
      viewOrders: "Ver pedidos",
      dismiss: "Fechar",
      checking: "Verificando status…",
      timedOut: "Ainda pendente. Tente “Refresh Status” no pedido mais recente.",
    },
    fr: {
      title: "Confirmation du passage à l’annuel…",
      description: "La demande a été envoyée. Creem peut mettre un moment à confirmer la facturation prorata.",
      hint: "Si cela reste en attente, ouvrez votre dernière commande et cliquez sur « Refresh Status », ou vérifiez Creem → Transactions.",
      refreshNow: "Actualiser",
      viewOrders: "Voir les commandes",
      dismiss: "Fermer",
      checking: "Vérification…",
      timedOut: "Toujours en attente. Essayez « Refresh Status » depuis votre dernière commande.",
    },
    ru: {
      title: "Подтверждаем переход на годовой план…",
      description: "Запрос на апгрейд отправлен. Creem может потребовать время, чтобы подтвердить списание по прорации.",
      hint: "Если долго не меняется, откройте последний заказ и нажмите “Refresh Status” или проверьте Creem → Transactions.",
      refreshNow: "Обновить",
      viewOrders: "Заказы",
      dismiss: "Закрыть",
      checking: "Проверяем статус…",
      timedOut: "Всё ещё ожидается. Попробуйте “Refresh Status” в последнем заказе.",
    },
    de: {
      title: "Jahres-Upgrade wird bestätigt…",
      description: "Upgrade angefordert. Creem kann einen Moment brauchen, um die Prorationsbelastung zu bestätigen.",
      hint: "Wenn es aussteht, öffne deine letzte Bestellung und klicke “Refresh Status” oder prüfe Creem → Transactions.",
      refreshNow: "Jetzt aktualisieren",
      viewOrders: "Bestellungen",
      dismiss: "Schließen",
      checking: "Status wird geprüft…",
      timedOut: "Noch ausstehend. Bitte “Refresh Status” in der letzten Bestellung versuchen.",
    },
  };

  return {
    ...copy.en,
    ...(copy[locale] ?? {}),
  };
}

async function refreshLatestProfessionalOrderOnce(): Promise<void> {
  const listResp = await fetch("/api/orders?limit=10&offset=0&status=paid", { cache: "no-store" });
  const listJson = (await listResp.json().catch(() => null)) as
    | { ok: boolean; data?: { orders?: Array<{ id: string; productId?: string; paymentProvider?: string }> } }
    | null;
  if (!listResp.ok || !listJson?.ok) return;

  const orders = listJson.data?.orders ?? [];
  const latest = orders.find((o) => o.productId === "professional" && o.paymentProvider === "creem");
  if (!latest?.id) return;

  await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: latest.id, refresh: true }),
    cache: "no-store",
  }).catch(() => null);
}

export function UpgradePendingBanner({ locale }: { locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const t = useMemo(() => getCopy(locale), [locale]);
  const isPending = searchParams.get("upgrade") === "pending";

  const [message, setMessage] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [checking, setChecking] = useState(false);

  const didKickRefresh = useRef(false);
  const attempts = useRef(0);

  const baseMembershipHref = locale === defaultLocale ? "/membership" : `/${locale}/membership`;
  const successHref = locale === defaultLocale ? "/membership/upgrade-success" : `/${locale}/membership/upgrade-success`;
  const ordersHref = locale === defaultLocale ? "/orders" : `/${locale}/orders`;

  useEffect(() => {
    if (!isPending) return;
    try {
      const stored = window.sessionStorage.getItem("upgrade_pending_message");
      if (stored) {
        window.sessionStorage.removeItem("upgrade_pending_message");
        setMessage(stored);
      }
    } catch {
      // ignore
    }
  }, [isPending]);

  useEffect(() => {
    if (!isPending) return;
    let cancelled = false;

    const start = Date.now();
    const timeoutMs = 60_000;
    const pollMs = 2_000;

    async function tick() {
      if (cancelled) return;
      setChecking(true);

      try {
        if (!didKickRefresh.current) {
          didKickRefresh.current = true;
          await refreshLatestProfessionalOrderOnce();
        } else if (attempts.current < 3 && Date.now() - start > 8_000 * (attempts.current + 1)) {
          attempts.current += 1;
          await refreshLatestProfessionalOrderOnce();
        }

        const resp = await fetch("/api/membership/status", { cache: "no-store" });
        const json = (await resp.json().catch(() => null)) as
          | { ok: boolean; data?: { isPaid?: boolean; period?: "monthly" | "yearly" | null } }
          | null;

        const period = json?.data?.period ?? null;
        const isPaid = Boolean(json?.data?.isPaid);

        if (resp.ok && json?.ok && isPaid && period === "yearly") {
          router.replace(successHref);
          router.refresh();
          return;
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setChecking(false);
      }

      if (Date.now() - start >= timeoutMs) {
        if (!cancelled) setTimedOut(true);
        return;
      }

      setTimeout(tick, pollMs);
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [baseMembershipHref, isPending, router, successHref]);

  if (!isPending) return null;

  return (
    <Card className="mb-6 border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
          <span>{t.title}</span>
        </CardTitle>
        <CardDescription>{message ?? t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-neutral-700 dark:text-neutral-200">{t.hint}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              setTimedOut(false);
              await refreshLatestProfessionalOrderOnce();
              router.refresh();
            }}
            disabled={checking}
          >
            {checking ? t.checking : t.refreshNow}
          </Button>
          <Button type="button" variant="outline" onClick={() => (window.location.href = ordersHref)}>
            {t.viewOrders}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.replace(baseMembershipHref)}>
            {t.dismiss}
          </Button>
        </div>
        {timedOut ? <div className="text-xs text-amber-700 dark:text-amber-400">{t.timedOut}</div> : null}
      </CardContent>
    </Card>
  );
}
