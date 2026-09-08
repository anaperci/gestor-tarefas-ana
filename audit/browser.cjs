// Actual production UI, all /api requests intercepted with fictitious data.
// Start locally on port 3017, then run: node audit/browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:3017';
const user = { id: 'audit-user', username: 'audit', name: 'Audit User', role: 'admin', avatar: 'A', canAccessContent: true };
const projects = [{ id: 'audit-project', name: 'Audit Project', ownerId: user.id, workspaceId: 'audit-workspace', color: '#15708C', icon: '', sharedWith: [] }];
const task = { id: 'audit-task', title: 'Audit task', description: '<img src="/audit-missing.png" onerror="window.__auditXss=true">', status: 'todo', priority: 'medium', projectId: projects[0].id, assignedTo: user.id, createdBy: user.id, deadline: '', startDate: '', tagIds: [], checklist: [], subtasks: [], checked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const dashboard = { greeting: { name: 'Audit', period: 'tarde' }, weekly_stats: { done: 0, total: 1 }, today_tasks: [task], overdue_tasks: [], review_tasks: [], delegated_tasks: [], active_projects: [], today_routines: [], recent_notes: [], meta: { user_id: user.id, role: user.role } };
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const findings = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const requests = [];
    await context.route('**/*', async route => {
      const req = route.request(); const url = new URL(req.url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      requests.push({ path: url.pathname, method: req.method(), body: req.postData() });
      let data = [];
      if (url.pathname === '/api/auth/me') data = { user };
      else if (url.pathname === '/api/users') data = [user];
      else if (url.pathname === '/api/projects') {
        await new Promise(resolve => setTimeout(resolve, 250));
        data = projects;
      }
      else if (url.pathname === '/api/workspaces') data = [{ id: 'audit-workspace', name: 'Audit Workspace', ownerId: user.id, members: [user.id], color: '#15708C', icon: '' }];
      else if (url.pathname === '/api/tasks') data = req.method() === 'POST' ? { ...task, id: 'new-audit-task', ...req.postDataJSON() } : [task];
      else if (url.pathname === '/api/dashboard') data = dashboard;
      else if (url.pathname === '/api/notifications') data = { items: [], unread: 0 };
      else if (url.pathname === '/api/notes') data = [{ id: 'audit-note', title: 'Audit note', content: 'Original note', userId: user.id, pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
      else if (url.pathname === '/api/routines') data = { items: [], checks: [] };
      else if (url.pathname === '/api/routines/history') data = { history: [] };
      else if (req.method() !== 'GET') data = { ...task, success: true };
      await route.fulfill({ json: data });
    });
    await context.addInitScript(() => localStorage.setItem('taskhub-token', 'fictitious-audit-token'));
    const page = await context.newPage();
    const response = await page.goto(base + '/?tarefa=audit-task');
    await page.waitForFunction(() => window.__auditXss === true);
    findings.push('B01: stored HTML event handler executes in actual task editor');
    assert.match(response.headers()['permissions-policy'], /microphone=\(\)/);
    assert.equal(await page.evaluate(() => document.featurePolicy.allowsFeature('microphone')), false);
    findings.push('B02: microphone denied by effective document policy');
    assert.equal(await page.evaluate(() => document.featurePolicy.allowsFeature('camera')), false);
    await page.screenshot({ path: path.join(__dirname, 'task-editor.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Anotações', exact: true }).click();
    await page.getByText('Audit note', { exact: true }).click();
    await page.locator('[contenteditable=true]').fill('UNSAVED AUDIT NOTE');
    await page.getByRole('button', { name: 'Rotina', exact: true }).click();
    await page.waitForTimeout(1700);
    assert.equal(requests.filter(r => r.path === '/api/notes/audit-note' && r.method === 'PUT').length, 0);
    findings.push('B03: leaving notes before 1500ms cancels save and loses edit');
    await page.getByRole('button', { name: 'Minha Área', exact: true }).click();
    await page.getByRole('button', { name: /Nova tarefa/ }).first().waitFor();
    await page.locator('body').click({ position: { x: 1000, y: 800 } });
    requests.length = 0;
    await page.keyboard.press('n');
    await page.waitForTimeout(500);
    const created = requests.filter(r => r.path === '/api/tasks' && r.method === 'POST');
    assert.equal(created.length, 0);
    await page.getByText(/Nenhum projeto disponível\. Peça ao admin/).waitFor();
    assert.equal(await page.getByPlaceholder('O que precisa ser feito?').isVisible(), true);
    findings.push('B04: N opens quick task but also falsely reports no projects (stale global handler)');
    await page.screenshot({ path: path.join(__dirname, 'shortcut-n.png') });
    // Corrupt optional preference must not crash the whole application.
    await page.evaluate(() => localStorage.setItem('nexia-group-order', '{broken'));
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.reload(); await page.waitForTimeout(1000);
    assert.ok(errors.some(e => /JSON|property name|position|SyntaxError/i.test(e)));
    findings.push('B05: malformed saved group order crashes app during render');
    fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify({ scope: 'Production UI with fake API; no real data', findings, errors }, null, 2) + '\n');
    console.log(JSON.stringify(findings, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
