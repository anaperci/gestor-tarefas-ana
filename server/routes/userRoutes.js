const express = require("express");
const { db, hashPassword, genId } = require("../db");
const { authMiddleware, adminOnly } = require("../auth");

const router = express.Router();

router.use(authMiddleware);

// GET /api/users
router.get("/", (req, res) => {
  const users = db.prepare("SELECT id, username, name, role, avatar, created_at FROM users").all();
  res.json(users);
});

// POST /api/users (admin only)
router.post("/", adminOnly, (req, res) => {
  const { username, name, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username e senha obrigatórios" });
  if (!["admin", "editor", "viewer"].includes(role)) return res.status(400).json({ error: "Role inválida" });

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: "Username já existe" });

  const avatars = { admin: "👑", editor: "✏️", viewer: "👁️" };
  const id = "user-" + genId();
  db.prepare("INSERT INTO users (id, username, name, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, username.toLowerCase().trim(), name || username, hashPassword(password), role, avatars[role] || "👤");

  res.status(201).json({ id, username: username.toLowerCase().trim(), name: name || username, role, avatar: avatars[role] });
});

// PUT /api/users/:id/password (admin only)
router.put("/:id/password", adminOnly, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Nova senha obrigatória" });
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), req.params.id);
  res.json({ success: true });
});

// PUT /api/users/:id/role (admin only)
router.put("/:id/role", adminOnly, (req, res) => {
  const { role } = req.body;
  if (!["admin", "editor", "viewer"].includes(role)) return res.status(400).json({ error: "Role inválida" });
  const avatars = { admin: "👑", editor: "✏️", viewer: "👁️" };
  db.prepare("UPDATE users SET role = ?, avatar = ? WHERE id = ?").run(role, avatars[role], req.params.id);
  res.json({ success: true });
});

// DELETE /api/users/:id (admin only)
router.delete("/:id", adminOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Não pode deletar a si mesmo" });
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
