"use client";

import dynamic from "next/dynamic";

const TaskManager = dynamic(() => import("@/components/task-manager"), {
  ssr: false,
});

export default function Home() {
  return <TaskManager />;
}
