"use client";

import { useMemo, useState } from "react";

import type { Locale } from "@/i18n/types";
import { UpgradeYearlyConfirm } from "@/components/membership/upgrade-yearly-confirm";

export function UpgradeYearlyAgreement({
  locale,
  paymentProvider,
  agree1,
  agree2,
}: {
  locale: Locale;
  paymentProvider: string | null;
  agree1: string;
  agree2: string;
}) {
  const [a1, setA1] = useState(false);
  const [a2, setA2] = useState(false);

  const disabled = useMemo(() => !(a1 && a2), [a1, a2]);

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input type="checkbox" className="mt-1" checked={a1} onChange={(e) => setA1(e.target.checked)} />
        <span>{agree1}</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input type="checkbox" className="mt-1" checked={a2} onChange={(e) => setA2(e.target.checked)} />
        <span>{agree2}</span>
      </label>

      <UpgradeYearlyConfirm locale={locale} paymentProvider={paymentProvider} disabled={disabled} />
    </div>
  );
}

