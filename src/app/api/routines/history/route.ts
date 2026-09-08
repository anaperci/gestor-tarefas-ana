import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-error";
import { daysAgo, dayOfWeek, todayDate } from "@/lib/dates";
const daysSchema=z.coerce.number().int().min(1).max(365).default(7);
export const GET=withErrorHandling(async request=>{
 const user=await requireAuth(request);
 const days=daysSchema.parse(new URL(request.url).searchParams.get("days")??undefined);
 const [{data:items},{data:checks},{data:versions}]=await Promise.all([
  supabase.from("routine_items").select("id,days,created_at,deleted_at,active").eq("user_id",user.id),
  supabase.from("routine_checks").select("routine_item_id,check_date").eq("user_id",user.id).gte("check_date",daysAgo(days-1)),
  supabase.from("routine_schedule_history").select("routine_item_id,effective_date,days,active").order("effective_date",{ascending:false})
 ]);
 const history=Array.from({length:days},(_,i)=>{
  const date=daysAgo(days-1-i),dow=dayOfWeek(date);
  const scheduled=(items??[]).filter(r=>{
    if(todayDate(new Date(r.created_at))>date || (r.deleted_at && todayDate(new Date(r.deleted_at))<=date)) return false;
    const version=(versions??[]).find(v=>v.routine_item_id===r.id && v.effective_date<=date);
    return (version?.active??r.active) && (version?.days??r.days??[0,1,2,3,4,5,6]).includes(dow);
  });
  const ids=new Set(scheduled.map(r=>r.id));
  return {date,total:ids.size,completed:(checks??[]).filter(c=>c.check_date===date && ids.has(c.routine_item_id)).length};
 });
 return NextResponse.json({history});
});
