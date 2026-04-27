"use client";

import useSWR from "swr";
import type { DashboardPayload } from "./types";

const API_BASE = "/api";

async function fetcher(path: string): Promise<DashboardPayload> {
  const token = typeof window !== "undefined" ? localStorage.getItem("taskhub-token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Erro" }));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<DashboardPayload>;
}

export function useDashboardData() {
  return useSWR<DashboardPayload>("/dashboard", fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 60_000, // refresh em background a cada 60s
  });
}
