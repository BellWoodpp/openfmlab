"use client";

import { getRefundCopy } from "@/components/orders/refund-i18n";

export function RefundTerms({ locale }: { locale: string }) {
  const copy = getRefundCopy(locale);
  const tip = copy.terms.tip?.trim();

  return (
    <div className="space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
      <p className="font-medium">{copy.terms.title}</p>
      <ul className="list-disc pl-5 space-y-1">
        {copy.terms.bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {tip ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{tip}</p>
      ) : null}
    </div>
  );
}
