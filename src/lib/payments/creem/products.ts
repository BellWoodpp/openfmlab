function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export type CreemSupportedPeriod = "one-time" | "monthly" | "yearly";

export function parseCreemProductsEnv(raw: unknown): unknown {
  if (raw == null || raw === "") return {};
  const text = stripWrappingQuotes(String(raw));
  try {
    return JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`CREEM_PRODUCTS must be valid JSON (got parse error: ${message})`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function listCreemProductsKeys(parsed: unknown): string[] {
  if (!isPlainObject(parsed)) return [];
  return Object.keys(parsed).sort();
}

export function resolveCreemProductId(opts: {
  parsedProducts: unknown;
  productKey: string;
  period: CreemSupportedPeriod;
}): string | null {
  const { parsedProducts, productKey, period } = opts;
  if (!isPlainObject(parsedProducts)) return null;

  const directKey = `${productKey}:${period}`;
  const direct = parsedProducts[directKey];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const altKeys = [`${productKey}_${period}`, `${productKey}-${period}`];
  for (const key of altKeys) {
    const value = parsedProducts[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const nested = parsedProducts[productKey];
  if (isPlainObject(nested)) {
    const value = nested[period];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}
