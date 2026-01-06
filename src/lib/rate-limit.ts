type RateLimitState = {
  resetAtMs: number;
  remaining: number;
};

const buckets = new Map<string, RateLimitState>();

export type HttpError = Error & { status?: number };

function withStatus(error: Error, status: number): HttpError {
  return Object.assign(error, { status });
}

export function rateLimitOrThrow(opts: {
  key: string;
  windowMs: number;
  max: number;
  nowMs?: number;
}) {
  const nowMs = opts.nowMs ?? Date.now();
  const existing = buckets.get(opts.key);

  if (!existing || existing.resetAtMs <= nowMs) {
    buckets.set(opts.key, { resetAtMs: nowMs + opts.windowMs, remaining: opts.max - 1 });
    return;
  }

  if (existing.remaining <= 0) {
    const seconds = Math.max(0, Math.ceil((existing.resetAtMs - nowMs) / 1000));
    throw withStatus(new Error(`Rate limit exceeded. Try again in ${seconds}s.`), 429);
  }

  existing.remaining -= 1;
}
