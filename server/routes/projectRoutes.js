const express = require("express");
const { db, genId } = require("../db");
const { authMiddleware, adminOnly } = require("../auth");

const router = express.Router();

router.use(authMiddleware);

function getProjectsForUser(user) {
  if (user.role === "admin") {
    return db.prepare("SELECT * FROM projects ORDER BY created_at").all();
  }
  return db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_shares ps ON p.id = ps.project_id
    WHERE p.owner_id = ? OR ps.user_id = ?
    ORDER BY p.created_at
  `).all(user.id, user.id);
}

function getShares(projectId) {
  return db.prepare("SELECT user_id FROM project_shares WHERE project_id = ?").all(projectId).map(r => r.user_id);
}

// GET /api/projects
router.get("/", (req, res) => {
  const projects = getProjectsForUser(req.user);
  const result = projects.map(p => ({ ...p, sharedWith: getShares(p.id) }));
  res.json(result);
});

// POST /api/projects (admin only)
router.post("/", adminOnly, (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });
  const id = "proj-" + genId();
  db.prepare("INSERT INTO projects (id, name, color, icon, owner_id) VALUES (?, ?, ?, ?, ?)")
    .run(id, name, color || "#7B61FF", icon || "📌", req.user.id);
  res.status(201).json({ id, name, color: color || "#7B61FF", icon: icon || "📌", ownerId: req.user.id, sharedWith: [] });
});

// PUT /api/projects/:id/share
router.put("/:id/share", adminOnly, (req, res) => {
  const { sharedWith } = req.body; // array of user IDs
  if (!Array.isArray(sharedWith)) return res.status(400).json({ error: "sharedWith deve ser um array" });

  db.prepare("DELETE FROM project_shares WHERE project_id = ?").run(req.params.id);
  const insert = db.prepare("INSERT INTO project_shares (project_id, user_id) VALUES (?, ?)");
  for (const userId of sharedWith) {
    insert.run(req.params.id, userId);
  }
  res.json({ success: true, sharedWith });
});

// DELETE /api/projects/:id (admin only)
router.delete("/:id", adminOnly, (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
