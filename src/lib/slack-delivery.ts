import {supabase} from './supabase';
import type {TaskRow} from './tasks';

export function isCreationGroup(name:string):boolean {
 return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='criacao';
}
export function slackText(value:string):string {return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
export function validWebhook(value:string):boolean {
 try {const url=new URL(value);return url.origin==='https://hooks.slack.com' && /^\/services\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash;}catch{return false;}
}
export type SlackResult={ok:true}|{ok:false;error:string;retryAfter:number;permanent:boolean};
export async function sendSlack(url:string,payload:unknown):Promise<SlackResult> {
 if(!validWebhook(url))return {ok:false,error:'Webhook do Slack inválido',retryAfter:0,permanent:true};
 try {
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10_000),redirect:'error'});
  const body=(await response.text()).trim();
  if(response.ok && body==='ok')return {ok:true};
  const retry=Number(response.headers.get('retry-after'));
  return {ok:false,error:`Slack recusou o envio (HTTP ${response.status})`,retryAfter:Number.isFinite(retry)&&retry>0?Math.min(86400,retry):60,permanent:response.status>=400&&response.status<500&&response.status!==429};
 }catch{return {ok:false,error:'Não foi possível confirmar o envio ao Slack',retryAfter:60,permanent:false};}
}
export function taskMessage(task:Pick<TaskRow,'id'|'title'|'priority'|'deadline'>,project:string,group:string,assignee:string,baseUrl:string) {
 const url=`${baseUrl.replace(/\/$/,'')}/?tarefa=${encodeURIComponent(task.id)}`;
 const priority:Record<string,string>={critical:'Crítica',high:'Alta',medium:'Média',low:'Baixa'};
 const lines=['Oi time,','',`Nova tarefa no grupo *${slackText(group)}*.`,`*Projeto:* ${slackText(project)}`,`*Tarefa:* ${slackText(task.title)}`,`*Responsável:* ${slackText(assignee||'Não definido')}`,`*Urgência:* ${slackText(priority[task.priority]??task.priority)}`];
 if(task.deadline)lines.push(`*Prazo:* ${slackText(task.deadline.split('-').reverse().join('/'))}`);
 return {text:`Nova tarefa em ${slackText(project)}: ${slackText(task.title)}`,blocks:[{type:'section',text:{type:'mrkdwn',text:lines.join('\n')}},{type:'actions',elements:[{type:'button',text:{type:'plain_text',text:'Abrir tarefa'},url,style:'primary'}]}]};
}
interface Job {task_id:string;attempts:number;lock_token:string;}
export async function processCreationNotification() {
 const {data:jobs}=await supabase.rpc('claim_creation_slack');
 const job=(jobs as Job[]|null)?.[0];if(!job)return {status:'idle'};
 const finish=async(patch:Record<string,unknown>)=>{
  await supabase.from('slack_task_outbox').update({...patch,lock_token:null,locked_until:null}).eq('task_id',job.task_id).eq('lock_token',job.lock_token);
 };
 const retry=async(error:string,seconds:number)=>finish({status:'pending',last_error:error,next_attempt_at:new Date(Date.now()+seconds*1000).toISOString()});
 try {
  const {data:task}=await supabase.from('tasks').select('*').eq('id',job.task_id).is('deleted_at',null).maybeSingle();
  if(!task || !task.group_id || task.project_id.startsWith('personal-')){await finish({status:'cancelled'});return {status:'cancelled'};}
  const [{data:group},{data:project},{data:config}]=await Promise.all([
   supabase.from('task_groups').select('name,project_id').eq('id',task.group_id).is('deleted_at',null).maybeSingle(),
   supabase.from('projects').select('name,workspace_id').eq('id',task.project_id).is('deleted_at',null).maybeSingle(),
   supabase.from('slack_group_channels').select('webhook_url').eq('group_key','criacao').maybeSingle(),
  ]);
  let workspaceActive=true;
  if(project?.workspace_id){const {data:ws}=await supabase.from('workspaces').select('id').eq('id',project.workspace_id).is('deleted_at',null).maybeSingle();workspaceActive=!!ws;}
  if(!project || !workspaceActive || !group || group.project_id!==task.project_id || !isCreationGroup(group.name)){await finish({status:'cancelled'});return {status:'cancelled'};}
  if(!config?.webhook_url){await retry('Conecte o canal de Criação no painel de administração',60);return {status:'unconfigured'};}
  const {data:assignee}=task.assigned_to?await supabase.from('users').select('name').eq('id',task.assigned_to).is('deleted_at',null).maybeSingle():{data:null};
  const result=await sendSlack(config.webhook_url,taskMessage(task,project.name,group.name,assignee?.name??'',process.env.NEXT_PUBLIC_APP_URL||''));
  if(result.ok){await finish({status:'sent',delivered_at:new Date().toISOString(),last_error:null});return {status:'sent'};}
  if(result.permanent){await finish({status:'failed',last_error:result.error});return {status:'failed'};}
  await retry(result.error,Math.max(result.retryAfter,Math.min(3600,5*2**Math.min(job.attempts,10))));return {status:'retry'};
 }catch {
  await retry('Falha temporária ao processar a notificação',60);return {status:'retry'};
 }
}
