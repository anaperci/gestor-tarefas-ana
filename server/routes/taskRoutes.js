const express = require("express");
const { db, genId } = require("../db");
const { authMiddleware, editorOrAdmin } = require("../auth");

const router = express.Router();

router.use(authMiddleware);

function canAccessProject(user, projectId) {
  if (user.role === "admin") return true;
  const proj = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!proj) return false;
  if (proj.owner_id === user.id) return true;
  const share = db.prepare("SELECT 1 FROM project_shares WHERE project_id = ? AND user_id = ?").get(projectId, user.id);
  return !!share;
}

function enrichTask(task) {
  const checklist = db.prepare("SELECT id, text, done FROM checklist_items WHERE task_id = ? ORDER BY sort_order").all(task.id);
  const subtasks = db.prepare("SELECT id, title, status, checked FROM subtasks WHERE task_id = ? ORDER BY sort_order").all(task.id);
  return {
    ...task,
    checked: !!task.checked,
    checklist: checklist.map(c => ({ ...c, done: !!c.done })),
    subtasks: subtasks.map(s => ({ ...s, checked: !!s.checked })),
    projectId: task.project_id,
    assignedTo: task.assigned_to,
    createdBy: task.created_by,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

// GET /api/tasks
router.get("/", (req, res) => {
  let tasks;
  if (req.user.role === "admin") {
    tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
  } else {
    tasks = db.prepare(`
      SELECT t.* FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
      WHERE p.owner_id = ? OR ps.user_id IS NOT NULL
      ORDER BY t.created_at DESC
    `).all(req.user.id, req.user.id);
  }
  res.json(tasks.map(enrichTask));
});

// POST /api/tasks
router.post("/", editorOrAdmin, (req, res) => {
  const { title, description, status, priority, deadline, projectId, assignedTo, link } = req.body;
  if (!title || !projectId) return res.status(400).json({ error: "Título e projeto obrigatórios" });
  if (!canAccessProject(req.user, projectId)) return res.status(403).json({ error: "Sem acesso ao projeto" });

  const id = "task-" + genId();
  db.prepare(
    `INSERT INTO tasks (id, title, description, status, priority, deadline, project_id, assigned_to, created_by, link, checked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(id, title, description || "", status || "todo", priority || "medium", deadline || "", projectId, assignedTo || req.user.id, req.user.id, link || "");

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  res.status(201).json(enrichTask(task));
});

// PUT /api/tasks/:id
router.put("/:id", editorOrAdmin, (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
  if (!canAccessProject(req.user, task.project_id)) return res.status(403).json({ error: "Sem acesso" });

  const { title, description, status, priority, deadline, projectId, assignedTo, link, checked, checklist, subtasks } = req.body;

  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, deadline = ?,
    project_id = ?, assigned_to = ?, link = ?, checked = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? task.title, description ?? task.description, status ?? task.status,
    priority ?? task.priority, deadline ?? task.deadline,
    projectId ?? task.project_id, assignedTo ?? task.assigned_to,
    link ?? task.link, checked ? 1 : 0, req.params.id
  );

  // Sync checklist
  if (Array.isArray(checklist)) {
    db.prepare("DELETE FROM checklist_items WHERE task_id = ?").run(req.params.id);
    const ins = db.prepare("INSERT INTO checklist_items (id, task_id, text, done, sort_order) VALUES (?, ?, ?, ?, ?)");
    checklist.forEach((item, i) => {
      ins.run(item.id || ("cl-" + genId()), req.params.id, item.text, item.done ? 1 : 0, i);
    });
  }

  // Sync subtasks
  if (Array.isArray(subtasks)) {
    db.prepare("DELETE FROM subtasks WHERE task_id = ?").run(req.params.id);
    const ins = db.prepare("INSERT INTO subtasks (id, task_id, title, status, checked, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
    subtasks.forEach((st, i) => {
      ins.run(st.id || ("st-" + genId()), req.params.id, st.title, st.status || "todo", st.checked ? 1 : 0, i);
    });
  }

  const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  res.json(enrichTask(updated));
});

// DELETE /api/tasks/:id
router.delete("/:id", editorOrAdmin, (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
