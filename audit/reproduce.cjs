/* Audit reproductions: run `node audit/reproduce.cjs` from the project root.
 * Loads the actual TypeScript handlers with an in-memory database and fake identity.
 * No environment file, network request, real account or production mutation is used.
 * Assertions confirm existing bugs; these are NOT passing regression tests for fixes.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let db, actor, faults, calls, cache;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = 'select'; }
  select(_columns, opts) { this.opts = opts; return this; }
  eq(k, v) { this.filters.push(r => r[k] === v); return this; }
  is(k, v) { this.filters.push(r => (r[k] ?? null) === v); return this; }
  in(k, v) { this.filters.push(r => v.includes(r[k])); return this; }
  gte(k, v) { this.filters.push(r => r[k] >= v); return this; }
  order() { return this; }
  limit(n) { this.max = n; return this; }
  range(a, b) { this.offset = a; this.max = b-a+1; return this; }
  maybeSingle() { this.singleRow = true; return this; }
  single() { this.singleRow = true; return this; }
  insert(value) { this.op = 'insert'; this.value = value; return this; }
  update(value) { this.op = 'update'; this.value = value; return this; }
  delete() { this.op = 'delete'; return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      calls.push({ table: this.table, op: this.op });
      if (faults.includes(`${this.table}:${this.op}`)) return { data: null, count: null, error: { message: 'Simulated database failure' } };
      const rows = db[this.table] ??= [];
      let matches = rows.filter(r => this.filters.every(f => f(r)));
      if (this.op === 'insert') { matches = structuredClone(Array.isArray(this.value) ? this.value : [this.value]); rows.push(...matches); }
      if (this.op === 'update') matches.forEach(r => Object.assign(r, this.value));
      if (this.op === 'delete') db[this.table] = rows.filter(r => !matches.includes(r));
      const count = matches.length;
      matches = matches.slice(this.offset ?? 0, this.max === undefined ? undefined : (this.offset ?? 0) + this.max);
      return { data: this.singleRow ? structuredClone(matches[0] ?? null) : structuredClone(matches), count, error: null };
    }).then(resolve, reject);
  }
}
const supabase = { from: t => new Query(t), rpc: async name => ({ data: structuredClone(db[name] ?? []), error: null }) };
function load(file) {
  file = path.resolve(root, file);
  if (cache[file]) return cache[file].exports;
  const mod = { exports: {} }; cache[file] = mod;
  const customRequire = spec => {
    if (spec === '@/lib/supabase' || spec === './supabase') return { supabase };
    if (spec === '@/lib/audit') return { audit: async () => {} };
    if (spec === '@/lib/slack') return { notificarTarefaCriada: async () => {} };
    let target;
    if (spec.startsWith('@/')) target = path.join(root, 'src', spec.slice(2));
    else if (spec.startsWith('.')) target = path.resolve(path.dirname(file), spec);
    else return require(spec);
    if (!path.extname(target)) target += '.ts';
    const result = load(target);
    if (target.endsWith('/lib/auth.ts')) return { ...result, requireAuth: async () => actor };
    return result;
  };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports,__dirname){${code}\n})`, { filename: file })(customRequire, mod, mod.exports, path.dirname(file));
  return mod.exports;
}
function reset() {
  db = {}; faults = []; calls = []; cache = {};
  actor = { id: 'auditor', username: 'auditor', name: 'Audit', role: 'editor', canAccessContent: true };
}
async function route(file, method, body, id='foreign') {
  const req = new Request('http://audit.invalid/api/test', { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) });
  return load(`src/app/api/${file}/route.ts`)[method](req, { params: Promise.resolve({ id, slideId: id }) });
}
const task = () => ({ id: 'foreign', title: 'Private task', description: 'Private body', project_id: 'private', assigned_to: 'owner', created_by: 'owner', status: 'todo', priority: 'medium', checked: false, deadline: '', updated_at: '2020-01-01' });
const results = [];
async function check(name, fn) { reset(); await fn(); results.push(name); console.log(`REPRODUCED: ${name}`); }
(async () => {
  await check('A01: export exposes a task to an unrelated editor', async () => {
    db.tasks = [task()]; db.projects = [{ id: 'private', owner_id: 'owner', name: 'Private' }];
    assert.equal(await load('src/lib/access.ts').userCanAccessProject(actor, 'private'), false);
    const res = await route('tasks/[id]/export', 'GET');
    assert.equal(res.status, 200); assert.match(await res.text(), /Private body/);
  });
  await check('A02: task comments expose unrelated private conversation', async () => {
    db.task_comments = [{ id: 'comment', task_id: 'foreign', body: 'Private comment' }];
    const res = await route('tasks/[id]/comments', 'GET');
    assert.equal(res.status, 200); assert.equal((await res.json())[0].body, 'Private comment');
  });
  await check('A03: all task groups exposed without project filtering', async () => {
    db.task_groups = [{ id: 'secret-group', project_id: 'private', name: 'Secret project group' }];
    const res = await route('task-groups', 'GET'); assert.equal((await res.json())[0].id, 'secret-group');
  });
  await check('A04: content slides editable outside actor workspace', async () => {
    db.content_slides = [{ id: 'foreign', content_item_id: 'private', body: 'Original' }];
    const res = await route('content/slides/[slideId]', 'PUT', { body: 'Overwritten' });
    assert.equal(res.status, 200); assert.equal(db.content_slides[0].body, 'Overwritten');
  });
  await check('A05: content transformation creates task in inaccessible project', async () => {
    db.content_items = [{ id: 'foreign', title: 'Secret content', workspace_id: 'private-workspace', body: 'Secret' }];
    db.projects = [{ id: 'private', owner_id: 'owner' }];
    assert.equal(await load('src/lib/access.ts').userCanAccessProject(actor, 'private'), false);
    const res = await route('content/[id]/transform-to-task', 'POST', { projectId: 'private' });
    assert.equal(res.status, 201); assert.equal(db.tasks[0].project_id, 'private');
  });
  await check('A06: checklist lost and HTTP 200 returned after insert failure', async () => {
    actor.role = 'admin'; db.tasks = [task()]; db.checklist_items = [{ id: 'old', task_id: 'foreign', text: 'Keep me' }];
    faults.push('checklist_items:insert');
    const res = await route('tasks/[id]', 'PUT', { checklist: [{ text: 'Replacement' }] });
    assert.equal(res.status, 200); assert.equal(db.checklist_items.length, 0);
  });
  await check('A07: clearing assignee with null leaves old assignee', async () => {
    actor.role = 'admin'; db.tasks = [task()];
    const res = await route('tasks/[id]', 'PUT', { assignedTo: null });
    assert.equal(res.status, 200); assert.equal(db.tasks[0].assigned_to, 'owner');
  });
  await check('A08: failed task query returns successful empty list', async () => {
    actor.role = 'admin'; faults.push('tasks:select');
    const res = await route('tasks', 'GET'); assert.equal(res.status, 200); assert.deepEqual(await res.json(), []);
  });
  await check('A09: attachments access helper ignores project share restrictions', async () => {
    db.tasks = [task()]; db.projects = [{ id: 'private', owner_id: 'owner', workspace_id: 'workspace' }];
    db.workspace_members = [{ workspace_id: 'workspace', user_id: actor.id }];
    db.project_shares = [{ project_id: 'private', user_id: 'other' }];
    assert.equal(await load('src/lib/access.ts').userCanAccessProject(actor, 'private'), false);
    await load('src/lib/auth.ts').assertTaskAccess(actor, 'foreign');
  });
  await check('A10: dashboard exposes another user personal project', async () => {
    actor.role = 'admin'; db.projects = [{ id: 'personal-owner', name: 'Pessoal', owner_id: 'owner' }];
    db.tasks = [{ ...task(), project_id: 'personal-owner' }];
    const res = await route('dashboard', 'GET'); const data = await res.json();
    assert.equal(data.active_projects[0].id, 'personal-owner');
    const normal = await route('projects', 'GET'); assert.deepEqual(await normal.json(), []);
  });
  await check('A11: weekly editor statistics include years-old tasks', async () => {
    db.get_user_tasks = [{ ...task(), status: 'done' }];
    const res = await route('dashboard', 'GET'); assert.equal((await res.json()).weekly_stats.done, 1);
  });
  await check('A12: content created without workspace becomes inaccessible to its creator', async () => {
    const res = await route('content', 'POST', { title: 'Lost draft' });
    assert.equal(res.status, 201); const item = await res.json();
    const read = await route('content/[id]', 'GET', undefined, item.id); assert.equal(read.status, 403);
  });
  await check('A13: content list silently truncates at 50 items', async () => {
    actor.role = 'admin'; db.content_items = Array.from({ length: 51 }, (_, i) => ({ id: `content-${i}` }));
    const res = await route('content', 'GET'); assert.equal((await res.json()).length, 50);
  });
  fs.writeFileSync(path.join(__dirname, 'reproduction-results.json'), JSON.stringify({ scope: 'Actual handlers; fake database and identity; confirms defects, not fixes', reproduced: results }, null, 2) + '\n');
})().catch(e => { console.error(e); process.exitCode = 1; });
