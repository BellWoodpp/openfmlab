import nextEnv from "@next/env";
import { createHash, createHmac } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

function stripWrappingQuotes(value) {
  const trimmed = String(value ?? "").trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function mustEnv(name) {
  const value = stripWrappingQuotes(process.env[name]);
  if (!value || !String(value).trim()) throw new Error(`${name} is not set`);
  return String(value).trim();
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

function signRequest({
  method,
  url,
  headers,
  payloadHash,
  accessKeyId,
  secretAccessKey,
  region = "auto",
  service = "s3",
  now,
}) {
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

function normalizeEndpoint(endpoint, bucket) {
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
  return normalizedEndpoint;
}

function buildR2Url({ endpoint, bucket, key }) {
  const base = `${normalizeEndpoint(endpoint, bucket)}/${encodeRfc3986(bucket)}`;
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

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function listFiles(rootDir) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      out.push(full);
    }
  }
  await walk(rootDir);
  return out.sort();
}

async function main() {
  nextEnv.loadEnvConfig(process.cwd(), false);

  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const prefixArg = process.argv.find((a) => a.startsWith("--prefix="));
  const prefix = prefixArg ? prefixArg.slice("--prefix=".length).replace(/^\/+|\/+$/g, "") : "";

  const endpoint = mustEnv("R2_ENDPOINT");
  const bucket = mustEnv("R2_BUCKET");
  const accessKeyId = mustEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = mustEnv("R2_SECRET_ACCESS_KEY");
  const cacheControl = process.env.R2_PUBLIC_CACHE_CONTROL?.trim() || "public, max-age=604800";

  const publicDir = path.join(process.cwd(), "public");
  const files = await listFiles(publicDir);
  if (files.length === 0) {
    console.log("[r2:upload-public] No files found in public/");
    return;
  }

  console.log("[r2:upload-public] bucket:", bucket);
  console.log("[r2:upload-public] files:", files.length);
  console.log("[r2:upload-public] dry-run:", dryRun);
  console.log("[r2:upload-public] prefix:", prefix ? `${prefix}/` : "(none)");

  let uploaded = 0;
  for (const filePath of files) {
    const rel = path.relative(publicDir, filePath).split(path.sep).join("/");
    const key = prefix ? `${prefix}/${rel}` : rel;
    const body = new Uint8Array(await fs.readFile(filePath));
    const contentType = guessContentType(filePath);

    if (dryRun) {
      console.log("[dry-run]", key, contentType, body.length);
      continue;
    }

    const url = buildR2Url({ endpoint, bucket, key });
    const payloadHash = sha256Hex(body);
    const signed = signRequest({
      method: "PUT",
      url,
      headers: {
        "content-type": contentType,
        "cache-control": cacheControl,
      },
      payloadHash,
      accessKeyId,
      secretAccessKey,
      region: "auto",
      service: "s3",
      now: new Date(),
    });

    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: signed,
      body: bodyInitFromUint8Array(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT failed (${res.status}) for ${key}: ${text || res.statusText}`);
    }

    uploaded += 1;
    if (uploaded % 10 === 0 || uploaded === files.length) {
      console.log(`[r2:upload-public] uploaded ${uploaded}/${files.length}`);
    }
  }

  console.log("[r2:upload-public] Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

