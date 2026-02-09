const jwt = require("jsonwebtoken");
const { db } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "taskhub-secret-key-change-in-prod";

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    const user = db.prepare("SELECT id, username, name, role, avatar FROM users WHERE id = ?").get(decoded.id);
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Acesso negado. Apenas admins." });
  }
  next();
}

function editorOrAdmin(req, res, next) {
  if (req.user.role === "viewer") {
    return res.status(403).json({ error: "Acesso negado. Viewers não podem editar." });
  }
  next();
}

module.exports = { generateToken, authMiddleware, adminOnly, editorOrAdmin, JWT_SECRET };
