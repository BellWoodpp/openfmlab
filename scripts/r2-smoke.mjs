import nextEnv from "@next/env";
import { createHash, createHmac, randomUUID } from "node:crypto";

function mustEnv(name) {
  const value = stripWrappingQuotes(process.env[name]);
  if (!value || !String(value).trim()) throw new Error(`${name} is not set`);
  return String(value).trim();
}

function stripWrappingQuotes(value) {
  const trimmed = String(value ?? "").trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function sha256Hex(data) {
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function toAmzDate(date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalUri(pathname) {
  return pathname
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      try {
        return encodeRfc3986(decodeURIComponent(seg));
      } catch {
        return encodeRfc3986(seg);
      }
    })
    .join("/");
}

function canonicalQueryString(url) {
  const items = [];
  url.searchParams.forEach((value, key) => {
    items.push([encodeRfc3986(key), encodeRfc3986(value)]);
  });
  items.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return items.map(([k, v]) => `${k}=${v}`).join("&");
}

function buildSignedHeaders(headers) {
  const entries = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase().trim(), String(v).trim()])
    .filter(([k, v]) => k && v);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const canonical = entries.map(([k, v]) => `${k}:${v}\n`).join("");
  const signed = entries.map(([k]) => k).join(";");
  return { canonical, signed };
}

function signRequest({ method, url, headers, payloadHash, accessKeyId, secretAccessKey, region = "auto", service = "s3", now }) {
  const { amzDate, dateStamp } = toAmzDate(now);

  const host = url.host;
  const baseHeaders = {
    host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...headers,
  };

  const { canonical, signed } = buildSignedHeaders(baseHeaders);
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(url.pathname),
    canonicalQueryString(url),
    canonical,
    signed,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
  return { ...baseHeaders, Authorization: authorization };
}

function buildR2Url({ endpoint, bucket, key }) {
  let normalizedEndpoint = String(endpoint).trim().replace(/\/$/, "");
  try {
    const parsed = new URL(normalizedEndpoint);
    const bucketSuffix = `/${bucket}`;
    if (parsed.pathname === bucketSuffix || parsed.pathname === `${bucketSuffix}/`) {
      normalizedEndpoint = parsed.origin;
    }
  } catch {
    // ignore
  }

  const base = `${normalizedEndpoint}/${encodeRfc3986(bucket)}`;
  const pathname = key ? `${base}/${key.split("/").map(encodeRfc3986).join("/")}` : base;
  return new URL(pathname);
}

function bodyInitFromUint8Array(body) {
  const buf = body.buffer;
  if (buf instanceof ArrayBuffer) {
    if (body.byteOffset === 0 && body.byteLength === buf.byteLength) return buf;
    return buf.slice(body.byteOffset, body.byteOffset + body.byteLength);
  }
  return body.slice().buffer;
}

async function signedFetch({ method, url, headers, body }) {
  const accessKeyId = mustEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = mustEnv("R2_SECRET_ACCESS_KEY");
  const payloadHash = sha256Hex(body ?? "");
  const signedHeaders = signRequest({
    method,
    url,
    headers: headers ?? {},
    payloadHash,
    accessKeyId,
    secretAccessKey,
    now: new Date(),
  });
  return fetch(url.toString(), {
    method,
    headers: signedHeaders,
    body: body ? bodyInitFromUint8Array(body) : undefined,
  });
}

async function main() {
  nextEnv.loadEnvConfig(process.cwd(), false);

  const endpoint = mustEnv("R2_ENDPOINT");
  const bucket = mustEnv("R2_BUCKET");

  const key = `smoke/${randomUUID()}.txt`;
  const url = buildR2Url({ endpoint, bucket, key });
  const bodyStr = `rtvox r2 smoke ${new Date().toISOString()}\n`;
  const body = new TextEncoder().encode(bodyStr);

  console.log("[r2:smoke] R2_ENDPOINT:", endpoint ? "set" : "missing");
  console.log("[r2:smoke] R2_BUCKET:", bucket ? "set" : "missing");
  console.log("[r2:smoke] key:", key);

  const put = await signedFetch({ method: "PUT", url, headers: { "content-type": "text/plain; charset=utf-8" }, body });
  const putText = await put.text().catch(() => "");
  if (!put.ok) throw new Error(`PUT failed (${put.status}): ${putText || put.statusText}`);
  console.log("[r2:smoke] PUT ok:", put.status);

  const get = await signedFetch({ method: "GET", url });
  const getBody = await get.text();
  if (!get.ok) throw new Error(`GET failed (${get.status}): ${getBody || get.statusText}`);
  if (getBody !== bodyStr) throw new Error("GET body mismatch");
  console.log("[r2:smoke] GET ok:", get.status);

  const del = await signedFetch({ method: "DELETE", url });
  const delText = await del.text().catch(() => "");
  if (!del.ok) throw new Error(`DELETE failed (${del.status}): ${delText || del.statusText}`);
  console.log("[r2:smoke] DELETE ok:", del.status);

  console.log("[r2:smoke] Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
