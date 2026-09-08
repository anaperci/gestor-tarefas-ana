import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateToken} from '../../src/lib/auth';
import {GET as exportTask} from '../../src/app/api/tasks/[id]/export/route';
import {GET as comments} from '../../src/app/api/tasks/[id]/comments/route';
import {GET as groups} from '../../src/app/api/task-groups/route';
import {GET as slides} from '../../src/app/api/content/[id]/slides/route';
import {POST as transform} from '../../src/app/api/content/[id]/transform-to-task/route';
import {PUT as share} from '../../src/app/api/projects/[id]/share/route';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.JWT_SECRET='test-only-secret';
const user={id:'e',username:'editor',name:'Editor',role:'editor',password_hash:'test-only',can_access_content:true};
test('real routes reject private task subresources and workspace content before writes',async()=>{
 const original=globalThis.fetch;const writes:string[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));let data:unknown=[];
  if(url.pathname.endsWith('/users'))data=[user];
  else if(url.pathname.endsWith('/tasks'))data=[{id:'t',project_id:'private'}];
  else if(url.pathname.endsWith('/rpc/can_access_project'))data=false;
  else if(url.pathname.endsWith('/rpc/get_user_projects'))data=[];
  else if(url.pathname.endsWith('/content_items'))data=[{id:'content',workspace_id:'private-ws',created_by:'owner'}];
  else if(url.pathname.endsWith('/workspaces'))data=[{id:'private-ws',owner_id:'owner'}];
  else if(url.pathname.endsWith('/workspace_members'))data=[];
  else if(init?.method && init.method!=='GET')writes.push(url.pathname);
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
 };
 const req=(path:string,method='GET')=>new Request('https://app.invalid'+path,{method,headers:{cookie:`clareza-session=${generateToken(user)}`,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({projectId:'private'})}:{})});
 try {
  assert.equal((await exportTask(req('/api/tasks/t/export'),{params:Promise.resolve({id:'t'})})).status,403);
  assert.equal((await comments(req('/api/tasks/t/comments'),{params:Promise.resolve({id:'t'})})).status,403);
  assert.deepEqual(await (await groups(req('/api/task-groups'),undefined)).json(),[]);
  assert.equal((await slides(req('/api/content/content/slides'),{params:Promise.resolve({id:'content'})})).status,403);
  assert.equal((await transform(req('/api/content/content/transform-to-task','POST'),{params:Promise.resolve({id:'content'})})).status,403);
  user.role='admin';assert.equal((await share(req('/api/projects/personal-owner/share','PUT'),{params:Promise.resolve({id:'personal-owner'})})).status,403);
  assert.deepEqual(writes,[]);
 }finally{globalThis.fetch=original;user.role='editor';}
});
test('task save accepts real Postgres timezone timestamps and clears assignee',async()=>{
 const {PUT:save}=await import('../../src/app/api/tasks/[id]/route');
 const original=globalThis.fetch;let patch:Record<string,unknown>|undefined;
 const row={id:'t',title:'Task',project_id:'p',group_id:null,status:'todo',checked:false,assigned_to:'e',updated_at:'2026-09-08T12:00:00.123456+00:00'};
 globalThis.fetch=async(input,init)=>{
  const path=new URL(String(input)).pathname;let data:unknown=[];
  if(path.endsWith('/users'))data=[user];else if(path.endsWith('/tasks'))data=[row];
  else if(path.endsWith('/rpc/can_access_project'))data=true;
  else if(path.endsWith('/rpc/save_task')){patch=JSON.parse(String(init?.body));data={...row,assigned_to:null};}
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const request=new Request('https://app.invalid/api/tasks/t',{method:'PUT',headers:{cookie:`clareza-session=${generateToken(user)}`,'content-type':'application/json'},body:JSON.stringify({assignedTo:null,expectedUpdatedAt:row.updated_at})});
  const result=await save(request,{params:Promise.resolve({id:'t'})});assert.equal(result.status,200);assert.equal((await result.json()).assignedTo,null);assert.equal(patch?.p_expected,row.updated_at);assert.equal(patch?.p_checklist,null);
 }finally{globalThis.fetch=original;}
});
