import nextEnv from "@next/env";
import { randomUUID } from "crypto";
import { Creem } from "creem";

function stripWrappingQuotes(value) {
  const trimmed = String(value ?? "").trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseProductsEnv(raw) {
  const text = stripWrappingQuotes(raw);
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CREEM_PRODUCTS must be a JSON object");
  }
  return parsed;
}

function getServerURL(env) {
  return env === "production" ? "https://api.creem.io" : "https://test-api.creem.io";
}

async function main() {
  const { loadEnvConfig } = nextEnv;
  loadEnvConfig(process.cwd(), false);

  const args = new Set(process.argv.slice(2));
  const retrieveOnly = args.has("--retrieve-only");
  const allowProduction = args.has("--allow-production");

  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) throw new Error("CREEM_API_KEY is not set");

  const env = process.env.CREEM_ENV || (process.env.NODE_ENV === "production" ? "production" : "test");
  if (env === "production" && !allowProduction) {
    throw new Error("Refusing to run against production. Pass --allow-production if intended.");
  }

  const products = parseProductsEnv(process.env.CREEM_PRODUCTS);
  const mappingKeys = ["professional:monthly", "professional:yearly"];

  console.log("CREEM_ENV:", env);
  console.log("CREEM_PRODUCTS keys:", Object.keys(products).sort());

  const creem = new Creem({ serverURL: getServerURL(env) });
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
  const successUrl = `${baseUrl.replace(/\/$/, "")}/en/payment/success`;

  for (const mappingKey of mappingKeys) {
    const productId = products[mappingKey];
    if (typeof productId !== "string" || !productId.trim()) {
      throw new Error(`Missing CREEM_PRODUCTS mapping for ${mappingKey}`);
    }

    const product = await creem.retrieveProduct({ xApiKey: apiKey, productId });
    console.log("Product OK:", {
      mappingKey,
      productId,
      name: product?.name,
      billingType: product?.billingType,
      billingPeriod: product?.billingPeriod,
      currency: product?.currency,
      price: product?.price,
    });

    if (retrieveOnly) continue;

    const requestId = randomUUID();
    const checkout = await creem.createCheckout({
      xApiKey: apiKey,
      createCheckoutRequest: {
        requestId,
        productId,
        customer: { email: `smoke-test+${Date.now()}@rtvox.local` },
        successUrl,
        metadata: { smoke: true, mappingKey },
      },
    });

    console.log("Checkout OK:", {
      mappingKey,
      requestId,
      checkoutId: checkout?.id,
      hasCheckoutUrl: Boolean(checkout?.checkoutUrl),
    });
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
