'use client';
import {useCallback,useEffect,useState} from 'react';
import {slackApi} from '@/lib/api';
interface Config {configurado:boolean;canalNome:string;pending:number;failed:number;lastDeliveredAt:string|null;}
export function SlackCreationSettings(){
 const [config,setConfig]=useState<Config|null>(null),[webhook,setWebhook]=useState(''),[channel,setChannel]=useState('Criação'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=useCallback(async()=>{try {const value=await slackApi.creationConfig();setConfig(value);setChannel(value.canalNome||'Criação');}catch{setMessage('Não foi possível carregar a integração.');}},[]);
 useEffect(()=>{
  let cancelled=false;
  slackApi.creationConfig().then(value=>{if(!cancelled){setConfig(value);setChannel(value.canalNome||'Criação');}}).catch(()=>{if(!cancelled)setMessage('Não foi possível carregar a integração.');});
  return ()=>{cancelled=true;};
 },[]);
 const run=async(action:()=>Promise<unknown>,success:string)=>{
  if(busy)return;setBusy(true);setMessage('');
  try {await action();setMessage(success);setWebhook('');await refresh();}catch(error){setMessage(error instanceof Error?error.message:'Falha na operação.');}finally{setBusy(false);}
 };
 return <section aria-label="Slack do grupo Criação" style={{padding:18,marginBottom:24,border:'1px solid var(--border)',borderRadius:12}}>
  <h3 style={{marginTop:0}}>Criação · todos os projetos</h3>
  <p>Uma única conexão para todos os grupos chamados “Criação”, inclusive os criados em novos projetos. Cada tarefa recebe uma notificação, mesmo quando começa como “Nova tarefa”.</p>
  <p role="status">{config?.configurado?`Canal conectado: ${config.canalNome}`:'Canal ainda não conectado'}{config?` · ${config.pending} pendente(s) · ${config.failed} com falha`:''}</p>
  {config?.lastDeliveredAt&&<p>Último envio confirmado: {new Date(config.lastDeliveredAt).toLocaleString('pt-BR')}</p>}
  <label style={{display:'block',marginBottom:10}}>Canal do Slack <input aria-label="Canal de Criação no Slack" value={channel} onChange={e=>setChannel(e.target.value)} placeholder="#criacao" /></label>
  <label style={{display:'block',marginBottom:10}}>Incoming Webhook <input type="password" autoComplete="new-password" aria-label="Webhook de Criação" value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder={config?.configurado?'Cole outra URL para trocar a conexão':'https://hooks.slack.com/services/...'} style={{width:'100%',padding:8}} /></label>
  <p style={{fontSize:12}}>O webhook define o canal de destino; o nome acima serve para identificação. A URL é protegida e não volta a ser exibida. Falhas temporárias ficam na fila para nova tentativa.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <button disabled={busy||!webhook.trim()} onClick={()=>void run(()=>slackApi.saveCreation(webhook.trim(),channel),'Conexão salva; os envios pendentes serão processados.')}>Salvar conexão</button>
   <button disabled={busy||!config?.configurado} onClick={()=>void run(slackApi.testCreation,'Mensagem de teste aceita pelo Slack.')}>Enviar mensagem de teste</button>
   <button disabled={busy||!config?.configurado} onClick={()=>{if(confirm('Desconectar o canal de Criação? As novas notificações ficarão pendentes.'))void run(slackApi.removeCreation,'Canal desconectado.');}}>Desconectar</button>
   <button disabled={busy} onClick={()=>void refresh()}>Atualizar status</button>
  </div>
  {message&&<p role="alert">{message}</p>}
 </section>;
}
