import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeHtml} from '../../src/lib/html';
import {todayDate,isOverdueDate,dayOfWeek} from '../../src/lib/dates';
import {TaskSaveQueue} from '../../src/lib/task-save-queue';
import type {Task,UpdateTaskPayload} from '../../src/lib/types';
import {supabase} from '../../src/lib/supabase';
import {generateToken,requireAuth,sessionResponse} from '../../src/lib/auth';
import {withErrorHandling} from '../../src/lib/api-error';
const task={id:'t',title:'Before',description:'',updatedAt:'2026-09-08T12:00:00Z',status:'todo',checked:false} as Task;
test('rich text preserves formatting and removes executable HTML and protocols',()=>{
 const clean=safeHtml('<p><b>Texto</b><img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">link</a></p>');
 assert.match(clean,/<b>Texto<\/b>/);assert.doesNotMatch(clean,/script|onerror|onclick|javascript|<img/);
});
test('civil deadlines follow São Paulo and stay valid throughout due day',()=>{
 const night=new Date('2026-09-09T01:30:00Z');assert.equal(todayDate(night),'2026-09-08');
 assert.equal(isOverdueDate('2026-09-08','todo',night),false);assert.equal(isOverdueDate('2026-09-07','todo',night),true);assert.equal(isOverdueDate('2026-09-07','done',night),false);assert.equal(dayOfWeek('2026-09-06'),0);
});
test('task queue serializes diffs with returned version and accepts newer refresh',async()=>{
 const calls:UpdateTaskPayload[]=[];let release:()=>void=()=>{};
 const gate=new Promise<void>(r=>release=r);
 const queue=new TaskSaveQueue(async(_id,patch)=>{calls.push(patch);if(calls.length===1) await gate;return {...task,...patch,updatedAt:`v${calls.length}`} as Task;});
 const a={...task,title:'First'};const b={...a,description:'Latest'};
 const first=queue.enqueue(task,a);const second=queue.enqueue(a,b);await Promise.resolve();assert.equal(calls.length,1);release();await Promise.all([first,second]);
 assert.equal(calls[1].expectedUpdatedAt,'v1');assert.equal(calls[1].title,undefined);assert.equal(calls[1].description,'Latest');
 await queue.enqueue({...b,updatedAt:'external'}, {...b,title:'new'});assert.equal(calls[2].expectedUpdatedAt,'external');
});
test('task queue stops on conflict rather than sending subsequent stale changes',async()=>{
 let calls=0;const queue=new TaskSaveQueue(async()=>{calls++;throw new Error('conflict');});
 const a={...task,title:'A'};const results=await Promise.allSettled([queue.enqueue(task,a),queue.enqueue(a,{...a,title:'B'})]);
 assert.equal(calls,1);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(queue.busy,false);
});
test('real PostgREST builder surfaces failures and revoked password sessions',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.JWT_SECRET='test-only-secret-not-a-real-credential';
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>new Response(JSON.stringify({code:'XX000',message:'failure'}),{status:500});
  await assert.rejects(async()=>await supabase.from('tasks').select('*'),/banco/);
  globalThis.fetch=async()=>new Response(JSON.stringify({code:'40001'}),{status:409});
  await assert.rejects(async()=>await supabase.rpc('save_task',{}),/mudaram/);
  const user={id:'a',username:'a',name:'A',role:'admin',avatar:'',password_hash:'hash-before'};
  globalThis.fetch=async()=>new Response(JSON.stringify([user]),{status:200,headers:{'content-type':'application/json'}});
  const token=generateToken(user);const request=new Request('https://app.invalid/api/tasks',{headers:{cookie:`clareza-session=${token}`}});
  assert.equal((await requireAuth(request)).id,'a');
  globalThis.fetch=async()=>new Response(JSON.stringify([{...user,password_hash:'hash-after'}]),{status:200,headers:{'content-type':'application/json'}});
  await assert.rejects(requireAuth(request),/senha foi alterada/);
  const response=sessionResponse(user);assert.match(response.headers.get('set-cookie')!,/HttpOnly/i);assert.equal((await response.json()).token,undefined);
 } finally {globalThis.fetch=original;}
});
test('cross-origin writes rejected before handler runs',async()=>{
 let ran=false;const handler=withErrorHandling(()=>{ran=true;return new Response('ok');});
 const response=await handler(new Request('https://app.invalid/api/tasks',{method:'POST',headers:{origin:'https://attacker.invalid'}}),undefined);
 assert.equal(response.status,403);assert.equal(ran,false);
});
