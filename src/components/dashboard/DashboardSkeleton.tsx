"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1600, margin: "0 auto" }}>
      <Skeleton height={104} rounded={16} />
      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={300} rounded={16} />
          <Skeleton height={180} rounded={16} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={240} rounded={16} />
          <Skeleton height={240} rounded={16} />
        </div>
      </div>
      <Skeleton height={260} rounded={16} />
    </div>
  );
}
