import {NextResponse} from 'next/server';
import {z} from 'zod';
import {supabase} from '@/lib/supabase';
import {requireAuth,assertAdmin} from '@/lib/auth';
import {withErrorHandling,parseJson,ApiError} from '@/lib/api-error';
import {validWebhook,sendSlack} from '@/lib/slack-delivery';
import {consumeRateLimit} from '@/lib/rate-limit';
const configSchema=z.object({webhookUrl:z.string().max(500).refine(validWebhook,'Use um Incoming Webhook válido do Slack'),canalNome:z.string().trim().min(1).max(80).default('Criação')});
export const GET=withErrorHandling(async request=>{
 assertAdmin(await requireAuth(request));
 const [{data:config},{count:pending},{count:failed},{data:last}]=await Promise.all([
  supabase.from('slack_group_channels').select('canal_nome').eq('group_key','criacao').maybeSingle(),
  supabase.from('slack_task_outbox').select('*',{count:'exact',head:true}).in('status',['pending','processing']),
  supabase.from('slack_task_outbox').select('*',{count:'exact',head:true}).eq('status','failed'),
  supabase.from('slack_task_outbox').select('delivered_at').eq('status','sent').order('delivered_at',{ascending:false}).limit(1).maybeSingle(),
 ]);
 return NextResponse.json({configurado:!!config,canalNome:config?.canal_nome??'',pending:pending??0,failed:failed??0,lastDeliveredAt:last?.delivered_at??null});
});
export const PUT=withErrorHandling(async request=>{
 assertAdmin(await requireAuth(request));const body=await parseJson(request,configSchema);
 await supabase.from('slack_group_channels').upsert({group_key:'criacao',webhook_url:body.webhookUrl,canal_nome:body.canalNome,updated_at:new Date().toISOString()});
 await supabase.from('slack_task_outbox').update({status:'pending',next_attempt_at:new Date().toISOString(),last_error:null}).in('status',['pending','failed']);
 return NextResponse.json({success:true});
});
export const DELETE=withErrorHandling(async request=>{
 assertAdmin(await requireAuth(request));await supabase.from('slack_group_channels').delete().eq('group_key','criacao');return NextResponse.json({success:true});
});
/** Only this explicit action sends a labelled configuration test. */
export const POST=withErrorHandling(async request=>{
 const user=await requireAuth(request);assertAdmin(user);await consumeRateLimit(user.id,{key:'slack-test',limit:3,windowMs:60000});
 const {data:config}=await supabase.from('slack_group_channels').select('webhook_url').eq('group_key','criacao').maybeSingle();
 if(!config)throw new ApiError('VALIDATION_ERROR','Conecte o canal de Criação primeiro.');
 const result=await sendSlack(config.webhook_url,{text:'Teste de integração do Clareza: novas tarefas no grupo Criação, de qualquer projeto, serão notificadas neste canal.'});
 if(!result.ok)throw new ApiError('BAD_REQUEST',result.error);
 return NextResponse.json({success:true});
});
