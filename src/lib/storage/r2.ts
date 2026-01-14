import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`${name} is not set`);
  return value.trim();
}

function getEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || !value.trim()) return null;
  return value.trim();
}

export function isR2Configured(): boolean {
  return Boolean(
    getEnv("R2_ENDPOINT") &&
      getEnv("R2_BUCKET") &&
      getEnv("R2_ACCESS_KEY_ID") &&
      getEnv("R2_SECRET_ACCESS_KEY"),
  );
}

function sha256Hex(data: string | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

function md5Base64(data: Uint8Array): string {
  const hash = createHash("md5");
  hash.update(data);
  return hash.digest("base64");
}

function hmac(key: Uint8Array, data: string): Uint8Array {
  return createHmac("sha256", key).update(data).digest();
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  // 20260114T011122Z
  const amzDate = iso;
  const dateStamp = iso.slice(0, 8);
  return { amzDate, dateStamp };
}

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalUri(pathname: string): string {
  // Preserve '/' but RFC3986-encode each segment.
  return pathname
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
}

function canonicalQueryString(url: URL): string {
  const items: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    items.push([encodeRfc3986(key), encodeRfc3986(value)]);
  });
  items.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return items.map(([k, v]) => `${k}=${v}`).join("&");
}

function buildSignedHeaders(headers: Record<string, string>): { canonical: string; signed: string } {
  const entries = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase().trim(), v.trim()] as const)
    .filter(([k, v]) => k && v);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const canonical = entries.map(([k, v]) => `${k}:${v}\n`).join("");
  const signed = entries.map(([k]) => k).join(";");
  return { canonical, signed };
}

function signRequest(opts: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  now: Date;
}): Record<string, string> {
  const { amzDate, dateStamp } = toAmzDate(opts.now);

  const host = opts.url.host;
  const baseHeaders: Record<string, string> = {
    host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": opts.payloadHash,
    ...opts.headers,
  };

  const { canonical, signed } = buildSignedHeaders(baseHeaders);
  const canonicalRequest = [
    opts.method.toUpperCase(),
    canonicalUri(opts.url.pathname),
    canonicalQueryString(opts.url),
    canonical,
    signed,
    opts.payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(new TextEncoder().encode(`AWS4${opts.secretAccessKey}`), dateStamp);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, opts.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;

  return {
    ...baseHeaders,
    Authorization: authorization,
  };
}

function buildR2Url(opts: { endpoint: string; bucket: string; key?: string; query?: Record<string, string> }): URL {
  const endpoint = opts.endpoint.replace(/\/$/, "");
  const base = `${endpoint}/${encodeRfc3986(opts.bucket)}`;
  const pathname = opts.key ? `${base}/${opts.key.split("/").map(encodeRfc3986).join("/")}` : base;
  const url = new URL(pathname);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      url.searchParams.set(k, v);
    }
  }
  return url;
}

async function r2Fetch(opts: {
  method: string;
  key?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: Uint8Array;
  bodyHash?: string;
}): Promise<Response> {
  const endpoint = mustGetEnv("R2_ENDPOINT");
  const bucket = mustGetEnv("R2_BUCKET");
  const accessKeyId = mustGetEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = mustGetEnv("R2_SECRET_ACCESS_KEY");

  const url = buildR2Url({ endpoint, bucket, key: opts.key, query: opts.query });

  const bodyHash = opts.bodyHash ?? sha256Hex(opts.body ?? "");
  const now = new Date();
  const signedHeaders = signRequest({
    method: opts.method,
    url,
    headers: opts.headers ?? {},
    payloadHash: bodyHash,
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
    now,
  });

  return fetch(url.toString(), {
    method: opts.method,
    headers: signedHeaders,
    body: opts.body,
  });
}

export async function r2PutObject(opts: {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}): Promise<{ key: string; size: number; etag?: string }> {
  if (!isR2Configured()) throw new Error("R2 is not configured");
  const res = await r2Fetch({
    method: "PUT",
    key: opts.key,
    headers: {
      "content-type": opts.contentType,
      ...(opts.cacheControl ? { "cache-control": opts.cacheControl } : {}),
    },
    body: opts.body,
    bodyHash: sha256Hex(opts.body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 PUT failed (${res.status}): ${text || res.statusText}`);
  }

  return { key: opts.key, size: opts.body.length, etag: res.headers.get("etag") ?? undefined };
}

export async function r2GetObject(opts: { key: string; range?: string | null }): Promise<Response> {
  if (!isR2Configured()) throw new Error("R2 is not configured");
  const res = await r2Fetch({
    method: "GET",
    key: opts.key,
    headers: {
      ...(opts.range ? { range: opts.range } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 GET failed (${res.status}): ${text || res.statusText}`);
  }
  return res;
}

export async function r2DeleteObject(key: string): Promise<void> {
  if (!isR2Configured()) return;
  const res = await r2Fetch({ method: "DELETE", key });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 DELETE failed (${res.status}): ${text || res.statusText}`);
  }
}

export async function r2DeleteObjects(keys: string[]): Promise<{ deleted: number; requestId: string }> {
  if (!isR2Configured()) return { deleted: 0, requestId: randomUUID() };
  const unique = Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean)));
  if (unique.length === 0) return { deleted: 0, requestId: randomUUID() };

  // R2 supports S3 DeleteObjects (POST ?delete).
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Delete>` +
    unique.map((k) => `<Object><Key>${k.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Key></Object>`).join("") +
    `</Delete>`;
  const body = new TextEncoder().encode(xml);

  const res = await r2Fetch({
    method: "POST",
    query: { delete: "" },
    headers: {
      "content-type": "application/xml",
      "content-md5": md5Base64(body),
    },
    body,
    bodyHash: sha256Hex(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 DeleteObjects failed (${res.status}): ${text || res.statusText}`);
  }

  return { deleted: unique.length, requestId: res.headers.get("x-amz-request-id") ?? randomUUID() };
}

