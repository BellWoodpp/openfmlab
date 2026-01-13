"use client";

import { useState } from "react";
import { membershipTokensForPeriod } from "@/lib/tokens/grants";

interface PaymentRequest {
  product_id: string;
  period?: string;
  locale?: string;
  intro_discount?: boolean;
}

interface PaymentResponse {
  ok: boolean;
  data?: {
    request_id?: string;
    session_id?: string;
    checkout_url?: string;
    action?: string;
    redirect_url?: string;
  };
  message?: string;
}

interface PaymentState {
  isLoading: boolean;
  error: string | null;
  checkoutUrl: string | null;
}

export function usePayment() {
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    error: null,
    checkoutUrl: null,
  });

  const createCheckout = async (
    productId: string,
    period?: string,
    locale?: string,
    opts?: { introDiscount?: boolean },
  ): Promise<boolean> => {
    setState({
      isLoading: true,
      error: null,
      checkoutUrl: null,
    });

    try {
      try {
        if (productId === "professional") {
          const resp = await fetch("/api/tokens", { cache: "no-store" });
          const json = (await resp.json().catch(() => null)) as { data?: { tokens?: unknown } } | null;
          const tokensRaw = json?.data?.tokens;
          const tokensBefore =
            typeof tokensRaw === "number" && Number.isFinite(tokensRaw) ? Math.floor(tokensRaw) : null;
          if (tokensBefore !== null) {
            window.sessionStorage.setItem("pro_tokens_before", String(tokensBefore));
          }

          const grant = membershipTokensForPeriod(period);
          if (grant) {
            window.sessionStorage.setItem("pro_expected_add", String(grant));
          }
        }
      } catch {
        // ignore
      }

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: productId,
          ...(period ? { period } : {}),
          ...(locale ? { locale } : {}),
          ...(typeof opts?.introDiscount === "boolean" ? { intro_discount: opts.introDiscount } : {}),
        } as PaymentRequest),
      });

      const result: PaymentResponse = await response.json();

      if (!result.ok) {
        throw new Error(result.message || "支付请求失败");
      }

      if (result.data?.redirect_url) {
        window.location.href = result.data.redirect_url;
        setState({
          isLoading: false,
          error: null,
          checkoutUrl: null,
        });
        return true;
      }

      if (!result.data?.checkout_url) {
        throw new Error(result.message || "未获取到支付链接");
      }

      setState({
        isLoading: false,
        error: null,
        checkoutUrl: result.data.checkout_url,
      });

      // 自动跳转到支付页面
      window.location.href = result.data.checkout_url;
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "支付请求失败";
      setState({
        isLoading: false,
        error: errorMessage,
        checkoutUrl: null,
      });
      return false;
    }
  };

  const reset = () => {
    setState({
      isLoading: false,
      error: null,
      checkoutUrl: null,
    });
  };

  return {
    ...state,
    createCheckout,
    reset,
  };
}
