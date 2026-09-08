"use client";

import useSWR from "swr";
import { sessionKey } from "./api";
import type { DashboardPayload } from "./types";

const API_BASE = "/api";

async function fetcher(path: string): Promise<DashboardPayload> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Erro" }));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<DashboardPayload>;
}

export function useDashboardData() {
  return useSWR<DashboardPayload>(["/dashboard", sessionKey()], () => fetcher("/dashboard"), {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 60_000, // refresh em background a cada 60s
  });
}
