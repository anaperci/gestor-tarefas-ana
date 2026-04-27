import { NextRequest } from "next/server";
import { ApiError } from "./api-error";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Identificador da janela — ex: "login". */
  key: string;
  /** Máximo de tentativas dentro da janela. */
  limit: number;
  /** Tamanho da janela em ms. */
  windowMs: number;
}

export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * In-memory rate limiter.
 *
 * Funciona bem para times pequenos. Em runtime serverless (Vercel), instâncias
 * são efêmeras — então o contador é "best effort": no pior caso, attacker
 * consegue N×instâncias tentativas por janela. Para hardening forte, trocar
 * por Upstash Redis (ver TODO no README).
 */
export function consumeRateLimit(identifier: string, opts: RateLimitOptions): void {
  const now = Date.now();
  const composite = `${opts.key}:${identifier}`;

  // GC ocasional: remove buckets expirados
  if (store.size > 1000) {
    for (const [k, b] of store) if (b.resetAt < now) store.delete(k);
  }

  const bucket = store.get(composite);
  if (!bucket || bucket.resetAt < now) {
    store.set(composite, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  if (bucket.count >= opts.limit) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError(
      "RATE_LIMITED",
      `Muitas tentativas. Tente novamente em ${retryAfterSec}s.`,
      { retryAfterSec }
    );
  }

  bucket.count += 1;
}
