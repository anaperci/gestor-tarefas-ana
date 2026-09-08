"use client";
import dynamic from "next/dynamic";
const TaskManager=dynamic(()=>import("./task-manager"),{ssr:false});
export default function TaskApp(props:{initialGroupId?:string;initialProjectId?:string}) { return <TaskManager {...props}/>; }
