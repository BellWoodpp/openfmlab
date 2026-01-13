"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/types";

interface PointsPaymentRequest {
  pack_id: string;
  locale: Locale;
}

interface PointsPaymentResponse {
  ok: boolean;
  data?: {
    request_id: string;
    session_id: string;
    checkout_url: string;
    order_id?: string;
  };
  message?: string;
}

interface PaymentState {
  isLoading: boolean;
  error: string | null;
  checkoutUrl: string | null;
}

type PointsCheckoutContext = {
  tokensBefore?: number | null;
  packCredits?: number | null;
};

export function usePointsPayment() {
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    error: null,
    checkoutUrl: null,
  });

  const createPointsCheckout = async (
    packId: string,
    locale: Locale,
    ctx?: PointsCheckoutContext,
  ): Promise<boolean> => {
    setState({ isLoading: true, error: null, checkoutUrl: null });

    try {
      try {
        if (typeof ctx?.tokensBefore === "number" && Number.isFinite(ctx.tokensBefore)) {
          window.sessionStorage.setItem("points_tokens_before", String(Math.floor(ctx.tokensBefore)));
        }
        if (typeof ctx?.packCredits === "number" && Number.isFinite(ctx.packCredits)) {
          window.sessionStorage.setItem("points_pack_credits", String(Math.floor(ctx.packCredits)));
        }
      } catch {
        // ignore
      }

      const response = await fetch("/api/payments/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: packId, locale } satisfies PointsPaymentRequest),
      });

      const result: PointsPaymentResponse = await response.json();

      if (!result.ok) {
        throw new Error(result.message || "Failed to create checkout");
      }

      if (!result.data?.checkout_url) {
        throw new Error("Missing checkout url");
      }

      setState({ isLoading: false, error: null, checkoutUrl: result.data.checkout_url });
      window.location.href = result.data.checkout_url;
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create checkout";
      setState({ isLoading: false, error: errorMessage, checkoutUrl: null });
      return false;
    }
  };

  const reset = () => {
    setState({ isLoading: false, error: null, checkoutUrl: null });
  };

  return { ...state, createPointsCheckout, reset };
}
