import {test,expect,type Page} from '@playwright/test';
const user={id:'test-user',username:'test',name:'Pessoa Teste',role:'admin',avatar:'A',canAccessContent:true};
const project={id:'test-project',name:'Projeto teste',ownerId:user.id,workspaceId:'test-workspace',color:'#15708C',icon:'',sharedWith:[]};
const group={id:'test-group',name:'Grupo lançamento',projectId:project.id,position:0,color:'#15708C'};
const baseTask={id:'test-task',title:'Tarefa do grupo',description:'<p>Descrição segura</p><img src="/missing" onerror="window.__xss=true">',status:'todo',priority:'medium',projectId:project.id,groupId:group.id,assignedTo:user.id,createdBy:user.id,deadline:'',startDate:'',estimateHours:null,tagIds:[],checklist:[],subtasks:[],checked:false,link:'',createdAt:'2026-09-08T12:00:00Z',updatedAt:'2026-09-08T12:00:00Z'};
async function fixture(page:Page, options:{signedIn?:boolean;failSave?:boolean;groupName?:string}={}){
 let signedIn=options.signedIn??true;let task={...baseTask};
 const writes:{path:string;body:Record<string,unknown>}[]=[];
 await page.context().route('**/*',async route=>{
  const req=route.request();const url=new URL(req.url());
  if(url.origin!=='http://127.0.0.1:3017')return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const p=url.pathname,method=req.method();let data:unknown=[];
  if(method!=='GET')writes.push({path:p,body:req.postDataJSON()??{}});
  if(p==='/api/auth/me') {if(!signedIn)return route.fulfill({status:401,json:{error:'Entre novamente'}});data={user};}
  else if(p==='/api/auth/login'){signedIn=true;data={user};}
  else if(p==='/api/auth/logout'){signedIn=false;data={success:true};}
  else if(p==='/api/users')data=[user];
  else if(p==='/api/projects')data=[project];
  else if(p==='/api/workspaces')data=[{id:'test-workspace',name:'Workspace teste',ownerId:user.id,members:[user.id],color:'#15708C',icon:''}];
  else if(p==='/api/task-groups')data=[{...group,name:options.groupName??group.name},{...group,id:'empty-group',name:'Grupo vazio',position:1}];
  else if(p==='/api/tasks')data=method==='POST'?{...task,...req.postDataJSON(),id:'new-task'}:[task,{...task,id:'another-task',title:'Tarefa fora do grupo',groupId:null}];
  else if(p==='/api/tasks/test-task'&&method==='PUT'){
   if(options.failSave)return route.fulfill({status:500,json:{error:'Falha simulada; rascunho preservado'}});
   task={...task,...req.postDataJSON(),updatedAt:new Date().toISOString()};data=task;
  }
  else if(p==='/api/dashboard')data={greeting:{name:'Pessoa',period:'tarde'},weekly_stats:{done:0,total:1},today_tasks:[],overdue_tasks:[],review_tasks:[],delegated_tasks:[],active_projects:[],today_routines:[],recent_notes:[],meta:{user_id:user.id,role:user.role}};
  else if(p==='/api/notifications')data={items:[],unread:0};
  else if(p==='/api/notes')data=[{id:'test-note',title:'Nota teste',content:'Texto original',userId:user.id,pinned:false,createdAt:task.createdAt,updatedAt:task.updatedAt}];
  else if(p==='/api/notes/test-note')data={id:'test-note',userId:user.id,...req.postDataJSON()};
  else if(p==='/api/routines')data={items:[],checks:[]};
  else if(p==='/api/routines/history')data={history:[]};
  else if(method!=='GET')data={success:true};
  await route.fulfill({json:data});
 });
 return writes;
}
test('group permanent URL filters tasks and survives rename/reload',async({page})=>{
 await fixture(page,{groupName:'Grupo renomeado'});await page.goto('/grupos/test-group');
 await expect(page.getByText('Tarefa do grupo',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('Tarefa fora do grupo',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Abrir grupo Grupo renomeado',exact:true})).toHaveAttribute('href','/grupos/test-group');
 await expect(page.getByRole('button',{name:'Copiar link do grupo Grupo renomeado'})).toBeVisible();
 await page.reload();await expect(page.getByText('Tarefa do grupo',{exact:true}).first()).toBeVisible();
});
test('empty groups have valid direct URLs',async({page})=>{
 await fixture(page);await page.goto('/grupos/empty-group');await expect(page.getByRole('link',{name:'Abrir grupo Grupo vazio',exact:true})).toBeVisible();
 await expect(page.getByText('Tarefa do grupo',{exact:true})).toHaveCount(0);
});
test('unknown or inaccessible group gives clear error',async({page})=>{
 await fixture(page);await page.goto('/grupos/inaccessible');await expect(page.getByRole('alert').filter({hasText:'sem permissão'})).toBeVisible();
});
test('login keeps deep group destination',async({page})=>{
 await fixture(page,{signedIn:false});await page.goto('/grupos/test-group');
 await page.locator('input[autocomplete=username]').fill('test');await page.locator('input[autocomplete=current-password]').fill('test-only');await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByText('Tarefa do grupo',{exact:true}).first()).toBeVisible();expect(new URL(page.url()).pathname).toBe('/grupos/test-group');
});
test('stored HTML cannot execute and microphone/calendar policies allow their features',async({page})=>{
 await fixture(page);const response=await page.goto('/grupos/test-group?tarefa=test-task');
 await expect(page.locator('[contenteditable=true]').first()).toBeVisible();
 expect(await page.evaluate(()=>('__xss' in window))).toBe(false);
 expect(await page.locator('[contenteditable=true]').first().innerHTML()).not.toContain('onerror');
 expect(response!.headers()['permissions-policy']).toContain('microphone=(self)');expect(response!.headers()['content-security-policy']).toContain('https://calendar.google.com');
});
test('leaving notes immediately flushes pending text',async({page})=>{
 const writes=await fixture(page);await page.goto('/');await page.getByRole('button',{name:'Anotações',exact:true}).click();
 await page.getByText('Nota teste',{exact:true}).click();await page.locator('[contenteditable=true]').fill('Texto que deve permanecer');await page.getByRole('button',{name:'Rotina',exact:true}).click();
 await expect.poll(()=>writes.filter(w=>w.path==='/api/notes/test-note').some(w=>String(w.body.content).includes('Texto que deve permanecer'))).toBe(true);
});
test('failed task save keeps recoverable draft',async({page})=>{
 await fixture(page,{failSave:true});await page.goto('/grupos/test-group?tarefa=test-task');
 const editor=page.locator('[contenteditable=true]').first();await editor.fill('Rascunho offline');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('clareza-task-draft:test-user:test-task'))).toContain('Rascunho offline');
 await expect(page.getByText(/alterações não salvas/i).first()).toBeVisible();
 await page.reload();await expect(page.locator('[contenteditable=true]').first()).toContainText('Rascunho offline');
});
test('corrupt optional preferences do not crash and mobile group links work',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await page.addInitScript(()=>localStorage.setItem('nexia-group-order','{broken'));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/grupos/test-group');await expect(page.getByText('Tarefa do grupo',{exact:true}).first()).toBeVisible();expect(errors).toEqual([]);
});
