"use client";

import { cn } from "@/lib/utils";
import { getPricingConfig, type PricingPeriod } from "@/lib/pricing/i18n-config";
import { type Locale } from "@/i18n/types";

interface BillingToggleProps {
  period: PricingPeriod;
  onPeriodChange: (period: PricingPeriod) => void;
  locale?: Locale;
  discountLabel: string;
  className?: string;
}

export function BillingToggle({
  period,
  onPeriodChange,
  locale = "en",
  discountLabel,
  className
}: BillingToggleProps) {
  const periods: PricingPeriod[] = ["monthly", "yearly"];
  const pricingConfig = getPricingConfig(locale);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="flex items-center space-x-1 rounded-lg bg-muted p-1 overflow-visible">
        {periods.map((p) => {
          const cycle = pricingConfig.billingCycles[p];
          const isActive = period === p;
          return (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? p === "monthly"
                    ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                    : "bg-amber-500 text-white shadow-sm dark:bg-amber-400 dark:text-neutral-950"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {p === "monthly" ? (
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
                    className="h-4 w-4"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
                  </svg>
                ) : null}
                {p === "yearly" ? (
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
                    className="h-4 w-4"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                ) : null}
                <span>{cycle.label}</span>
              </span>
              {p === 'yearly' && (
                <span className="pointer-events-none absolute -top-2 -right-2 rounded-full border border-purple-200/60 bg-purple-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-purple-900 shadow-sm dark:border-purple-500/30 dark:bg-purple-900/40 dark:text-purple-100">
                  {discountLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
