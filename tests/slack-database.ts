import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
async function main(){
 const db=new PGlite();await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 const migrations=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync('supabase/migrations/'+f,'utf8'));
 for(const migration of migrations.slice(0,-1))await db.exec(migration);
 await db.exec(`INSERT INTO users(id,username,name,password_hash,role) VALUES('legacy-u','legacy','Legacy','test-only','admin');
 INSERT INTO projects(id,name,owner_id,deleted_at) VALUES('legacy-p','Removed project','legacy-u',now());
 INSERT INTO slack_channels(project_id,webhook_url,canal_nome) VALUES('legacy-p','https://hooks.slack.com/services/T_TEST/B_TEST/fake','#CRIAÇÃO');`);
 await db.exec(migrations.at(-1)!);
 assert.equal((await db.query<{canal_nome:string}>("select canal_nome from slack_group_channels where group_key='criacao'")).rows[0].canal_nome,'#CRIAÇÃO');
 await db.exec(migrations.at(-1)!);
 assert.equal((await db.query<{ok:boolean}>("select is_creation_group($1) ok",["Criação"])).rows[0].ok,true);
 await db.exec(`INSERT INTO users(id,username,name,password_hash,role) VALUES('a','a','Admin','test-only','admin');
 INSERT INTO projects(id,name,owner_id) VALUES('p1','Project One','a'),('p2','Project Two','a'),('personal-a','Pessoal','a');
 INSERT INTO task_groups(id,project_id,name) VALUES('g1','p1','Criação'),('g2','p2','  CRIACAO  '),('g3','p1','Reels'),('gp','personal-a','Criação');
 INSERT INTO tasks(id,title,project_id,group_id,created_by) VALUES('t1','Nova tarefa','p1','g1','a'),('t2','From another system','p2','g2','a'),('t3','Other group','p1','g3','a'),('tp','Personal','personal-a','gp','a');`);
 assert.equal((await db.query('select * from slack_task_outbox')).rows.length,2);
 await db.exec("UPDATE tasks SET title='Final title' WHERE id='t1';UPDATE tasks SET group_id='g1' WHERE id='t1';");
 assert.equal((await db.query('select * from slack_task_outbox')).rows.length,2);
 await db.exec("UPDATE tasks SET group_id='g1' WHERE id='t3';");assert.equal((await db.query('select * from slack_task_outbox')).rows.length,3);
 assert.equal((await db.query('select * from claim_creation_slack()')).rows.length,0); // initial editing grace period
 await db.exec("UPDATE slack_task_outbox SET next_attempt_at=now()-interval '1 second';");
 const job=(await db.query<{task_id:string;lock_token:string}>('select * from claim_creation_slack()')).rows[0];assert.ok(job.lock_token);
 const other=(await db.query<{task_id:string}>('select * from claim_creation_slack()')).rows[0];assert.notEqual(job.task_id,other.task_id);
 await db.query("UPDATE slack_task_outbox SET status='sent',delivered_at=now() WHERE task_id=$1",[job.task_id]);
 await db.query('select queue_creation_slack($1)',[job.task_id]);assert.equal((await db.query<{status:string}>('select status from slack_task_outbox where task_id=$1',[job.task_id])).rows[0].status,'sent');
 await db.query('select queue_creation_slack($1,true)',[job.task_id]);assert.equal((await db.query<{status:string}>('select status from slack_task_outbox where task_id=$1',[job.task_id])).rows[0].status,'pending');
 // Creating a task and its notification are a single transaction.
 await assert.rejects(db.exec("BEGIN;INSERT INTO tasks(id,title,project_id,group_id,created_by) VALUES('rollback','Task','p1','g1','a');SELECT 1/0;COMMIT;"));await db.exec('ROLLBACK');
 assert.equal((await db.query("select * from slack_task_outbox where task_id='rollback'")).rows.length,0);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('select * from slack_group_channels'));await assert.rejects(db.query('select * from claim_creation_slack()'));await db.exec('RESET ROLE');
 await db.exec('SET ROLE service_role');assert.equal((await db.query("select * from slack_task_outbox")).rows.length,3);await db.exec('RESET ROLE');
 await db.close();console.log('Slack DB: creation groups across projects, quick-add, external inserts, deduplication, leases, retries, rollback and permissions passed.');
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
