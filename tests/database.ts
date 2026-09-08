import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
async function main() {
const db=new PGlite();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
const migration=readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(f=>f.endsWith('audit_reliability.sql')),'utf8');
await db.exec(migration);
await db.exec(migration); // reapply must be safe
await db.exec(`INSERT INTO users(id,username,name,password_hash,role) VALUES ('a','admin','Admin','test-only','admin'),('e','editor','Editor','test-only','editor'),('o','owner','Owner','test-only','editor'),('v','viewer','Viewer','test-only','viewer');
INSERT INTO workspaces(id,name,owner_id) VALUES ('w','Workspace','o');
INSERT INTO workspace_members VALUES('w','e'),('w','o');
INSERT INTO projects(id,name,owner_id,workspace_id) VALUES ('p','Private','o','w'),('personal-o','Pessoal','o',NULL);
INSERT INTO project_shares VALUES('p','o');
INSERT INTO tasks(id,title,project_id,assigned_to,created_by) VALUES('t','Task','p','o','o');
INSERT INTO checklist_items(id,task_id,text) VALUES('c','t','Original');`);
const access=async(u:string,p:string)=>(await db.query<{ok:boolean}>('select can_access_project($1,$2) ok',[u,p])).rows[0].ok;
assert.equal(await access('e','p'),false);assert.equal(await access('a','p'),true);assert.equal(await access('a','personal-o'),false);assert.equal(await access('o','personal-o'),true);
// Real transaction rollback: duplicate child IDs reject whole save.
await assert.rejects(db.query('select save_task($1,$2,NULL,$3,NULL)',['t',{title:'Should rollback'},[{id:'duplicate',text:'one'},{id:'duplicate',text:'two'}]]));
assert.equal((await db.query<{title:string}>('select title from tasks where id=\'t\'')).rows[0].title,'Task');
assert.equal((await db.query<{text:string}>('select text from checklist_items')).rows[0].text,'Original');
await db.query('select save_task($1,$2,NULL,NULL,NULL)',['t',{assigned_to:null,status:'done'}]);
const row=(await db.query<{assigned_to:string|null;checked:boolean;completed_at:string;updated_at:string}>('select * from tasks where id=\'t\'')).rows[0];
assert.equal(row.assigned_to,null);assert.equal(row.checked,true);assert.ok(row.completed_at);
await assert.rejects(db.query('select save_task($1,$2,$3,NULL,NULL)',['t',{title:'Stale'},'2000-01-01']));
await db.query('select save_task($1,$2,NULL,NULL,NULL)',['t',{checked:false}]);
assert.equal((await db.query<{status:string}>('select status from tasks where id=\'t\'')).rows[0].status,'todo');
await assert.rejects(db.query('select replace_project_shares($1,$2)',['p',['missing-user']]));
assert.equal(await access('e','p'),false);
// Roles can use only the server API; new tables have explicit service privileges.
await db.exec('SET ROLE service_role');
assert.equal(await access('o','p'),true);
await db.exec('RESET ROLE');
assert.equal((await db.query<{n:number}>("select consume_clareza_limit('test',1,60000) n")).rows[0].n,0);
assert.ok((await db.query<{n:number}>("select consume_clareza_limit('test',1,60000) n")).rows[0].n>0);
await db.query("select create_workspace('new-w','New','#15708C','','e')");
assert.equal((await db.query("select * from workspace_members where workspace_id='new-w' and user_id='e'")).rows.length,1);
await db.exec("INSERT INTO task_groups(id,project_id,name,position) VALUES('g','p','Group',0);UPDATE tasks SET group_id='g' WHERE id='t';");
await db.query("select delete_task_group('g')");
assert.equal((await db.query<{group_id:null}>("select group_id from tasks where id='t'")).rows[0].group_id,null);
await db.exec("INSERT INTO content_items(id,title,created_by,last_edited_by) VALUES('content','Idea','o','o');");
const first=(await db.query<{r:{taskId:string}}>("select transform_content_task('content','p','o') r")).rows[0].r;
const second=(await db.query<{r:{taskId:string;alreadyLinked:boolean}}>("select transform_content_task('content','p','o') r")).rows[0].r;
assert.equal(first.taskId,second.taskId);assert.equal(second.alreadyLinked,true);
await db.exec("SET ROLE anon");
await assert.rejects(db.query("select get_user_tasks('a')"));
await db.exec('RESET ROLE');
console.log('Database: migrations, reapply, permissions, personal privacy, rollback, concurrency, assignment and completion passed.');
await db.close();

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
