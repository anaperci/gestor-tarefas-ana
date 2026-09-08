import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { hashPassword, sessionResponse } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { nameSchema, usernameSchema } from "@/lib/validation";
import { passwordSchema } from "@/lib/password-policy";
import { consumeRateLimit, clientIp } from "@/lib/rate-limit";
const bodySchema=z.object({username:usernameSchema,name:nameSchema,password:passwordSchema});
export const GET=withErrorHandling(async()=>{
  if (process.env.ALLOW_SETUP!=="true") return NextResponse.json({setupRequired:false});
  const {count,error}=await supabase.from("users").select("id",{count:"exact",head:true});
  if(error || count===null) throw new ApiError("INTERNAL_ERROR","Falha ao verificar configuração");
  return NextResponse.json({setupRequired:count===0});
});
export const POST=withErrorHandling(async(request)=>{
  if(process.env.ALLOW_SETUP!=="true") throw new ApiError("FORBIDDEN","Configuração inicial desativada");
  await consumeRateLimit(clientIp(request),{key:"setup",limit:5,windowMs:3600_000});
  const body=await parseJson(request,bodySchema);
  const {data}=await supabase.rpc("bootstrap_admin",{p_user:{id:"user-"+genId(),username:body.username.toLowerCase().trim(),name:body.name.trim(),password_hash:await hashPassword(body.password)}});
  return sessionResponse(data,201);
});
