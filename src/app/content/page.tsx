"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Project, User } from "@/lib/types";
import { ContentBoard } from "@/components/content/ContentBoard";

export default function ContentPage() {
  return (
    <Suspense fallback={<AccessLoader />}>
      <ContentPageInner />
    </Suspense>
  );
}

function AccessLoader() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text-secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Loader2 size={18} className="spin" /> Verificando acesso…
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function ContentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get("item");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    api.me().then(async (me) => {
      if (!me.canAccessContent) {
        router.replace("/");
        return;
      }
      setCurrentUser(me);
      setAccessChecked(true);
      const [u, p] = await Promise.all([api.getUsers(), api.getProjects()]);
      setUsers(u);
      setProjects(p);
    }).catch(() => {
      router.replace("/");
    });
  }, [router]);

  if (!accessChecked || !currentUser) {
    return <AccessLoader />;
  }

  return (
    <main style={{ height: "100vh" }}>
      <ContentBoard
        currentUser={currentUser}
        users={users}
        projects={projects}
        initialItemId={initialItemId}
        onBackHome={() => router.push("/")}
      />
    </main>
  );
}
