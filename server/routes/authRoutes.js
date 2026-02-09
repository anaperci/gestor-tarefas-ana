const express = require("express");
const { db, hashPassword } = require("../db");
const { generateToken, authMiddleware } = require("../auth");

const router = express.Router();

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username e senha obrigatórios" });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
  if (user.password_hash !== hashPassword(password)) return res.status(401).json({ error: "Senha incorreta" });

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar }
  });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
