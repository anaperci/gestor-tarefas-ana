import { ApiError } from "./api-error";

import {createHash} from "node:crypto";
import {supabase} from "./supabase";

export interface RateLimitOptions {
  /** Identificador da janela — ex: "login". */
  key: string;
  /** Máximo de tentativas dentro da janela. */
  limit: number;
  /** Tamanho da janela em ms. */
  windowMs: number;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",").at(-1)!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Atomic PostgreSQL quota shared by all processes. */
export async function consumeRateLimit(identifier:string,opts:RateLimitOptions):Promise<void> {
 const key=createHash("sha256").update(`${opts.key}:${identifier}`).digest("hex");
 const {data:retry}=await supabase.rpc("consume_clareza_limit",{p_key:key,p_limit:opts.limit,p_window_ms:opts.windowMs});
 if(retry>0) throw new ApiError("RATE_LIMITED",`Muitas tentativas. Tente novamente em ${retry}s.`,{retryAfterSec:retry});
}
