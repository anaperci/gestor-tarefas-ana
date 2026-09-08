import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isCreationGroup,validWebhook,sendSlack,taskMessage,processCreationNotification} from '../../src/lib/slack-delivery';
const webhook='https://hooks.slack.com/services/T_TEST/B_TEST/not-a-real-secret';
test('creation name normalization and webhook origin validation',()=>{
 for(const name of ['Criação',' CRIACAO ','Criação'])assert.equal(isCreationGroup(name),true);
 assert.equal(isCreationGroup('Recriação'),false);assert.equal(isCreationGroup('Reels'),false);
 assert.equal(validWebhook(webhook),true);for(const invalid of ['http://hooks.slack.com/services/T/B/x','https://hooks.slack.com.attacker.invalid/services/T/B/x','https://hooks.slack.com/services/T/B/x?redirect=1'])assert.equal(validWebhook(invalid),false);
});
test('notification identifies project, includes placeholder titles, and escapes Slack mentions',()=>{
 const payload=taskMessage({id:'t',title:'Nova tarefa <!channel>',priority:'high',deadline:'2026-09-10'},'Projeto B','Criação','Pessoa','https://app.invalid');
 const json=JSON.stringify(payload);assert.match(json,/Projeto B/);assert.match(json,/Nova tarefa &lt;!channel&gt;/);assert.match(json,/10\/09\/2026/);assert.match(json,/[?]tarefa=t/);assert.doesNotMatch(json,/<\!channel>/);
});
test('Slack acknowledgement, permanent failures, rate limits and network errors',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>new Response('ok');assert.deepEqual(await sendSlack(webhook,{}),{ok:true});
  globalThis.fetch=async()=>new Response('not accepted');assert.equal((await sendSlack(webhook,{})).ok,false);
  globalThis.fetch=async()=>new Response('ratelimited',{status:429,headers:{'Retry-After':'120'}});const retry=await sendSlack(webhook,{});assert.equal(retry.ok,false);if(!retry.ok){assert.equal(retry.retryAfter,120);assert.equal(retry.permanent,false);}
  globalThis.fetch=async()=>new Response('invalid_payload',{status:400});const invalid=await sendSlack(webhook,{});if(!invalid.ok)assert.equal(invalid.permanent,true);else assert.fail();
  globalThis.fetch=async()=>{throw new Error(webhook);};const failed=await sendSlack(webhook,{});assert.equal(failed.ok,false);assert.ok(!JSON.stringify(failed).includes(webhook));
 }finally{globalThis.fetch=original;}
});
test('worker routes Creation from different projects to the same channel and retains unconfigured jobs',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.NEXT_PUBLIC_APP_URL='https://app.invalid';
 const original=globalThis.fetch;const messages:unknown[]=[];const finishes:Record<string,unknown>[]=[];let project='p1';let configured=true;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));let data:unknown=[];
  if(url.origin==='https://hooks.slack.com'){messages.push(JSON.parse(String(init?.body)));return new Response('ok');}
  if(url.pathname.endsWith('/rpc/claim_creation_slack'))data=[{task_id:'t',attempts:1,lock_token:'lease'}];
  else if(url.pathname.endsWith('/tasks'))data=[{id:'t',title:'Nova tarefa',priority:'medium',deadline:'',group_id:'g',project_id:project,assigned_to:null}];
  else if(url.pathname.endsWith('/task_groups'))data=[{name:'Criação',project_id:project}];
  else if(url.pathname.endsWith('/projects'))data=[{name:project,workspace_id:null}];
  else if(url.pathname.endsWith('/slack_group_channels'))data=configured?[{webhook_url:webhook}]:[];
  else if(url.pathname.endsWith('/slack_task_outbox')){finishes.push(JSON.parse(String(init?.body)));return new Response(null,{status:204});}
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 };
 try {
  assert.equal((await processCreationNotification()).status,'sent');project='p2';assert.equal((await processCreationNotification()).status,'sent');
  assert.equal(messages.length,2);assert.match(JSON.stringify(messages[0]),/p1/);assert.match(JSON.stringify(messages[1]),/p2/);
  configured=false;assert.equal((await processCreationNotification()).status,'unconfigured');assert.equal(messages.length,2);assert.equal(finishes.at(-1)?.status,'pending');
 }finally{globalThis.fetch=original;}
});
