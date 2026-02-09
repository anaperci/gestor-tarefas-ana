#!/usr/bin/env node
const { db, hashPassword, genId } = require("./db");

const [,, command, ...args] = process.argv;

const ROLES = ["admin", "editor", "viewer"];

function printTable(rows) {
  if (rows.length === 0) { console.log("  (vazio)"); return; }
  const keys = Object.keys(rows[0]);
  const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] || "").length)));
  const sep = widths.map(w => "─".repeat(w + 2)).join("┼");
  console.log("┌" + sep.replace(/┼/g, "┬") + "┐");
  console.log("│" + keys.map((k, i) => ` ${k.padEnd(widths[i])} `).join("│") + "│");
  console.log("├" + sep + "┤");
  rows.forEach(r => {
    console.log("│" + keys.map((k, i) => ` ${String(r[k] || "").padEnd(widths[i])} `).join("│") + "│");
  });
  console.log("└" + sep.replace(/┼/g, "┴") + "┘");
}

switch (command) {
  case "list-users": {
    const users = db.prepare("SELECT id, username, name, role, avatar, created_at FROM users").all();
    console.log(`\n  📋 Usuários (${users.length}):\n`);
    printTable(users);
    break;
  }

  case "create-user": {
    const [username, password, role, ...nameParts] = args;
    if (!username || !password || !role) {
      console.error("Uso: node server/cli.js create-user <username> <password> <role> [name]");
      process.exit(1);
    }
    if (!ROLES.includes(role)) {
      console.error(`Role inválida. Use: ${ROLES.join(", ")}`);
      process.exit(1);
    }
    const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase());
    if (exists) {
      console.error(`Usuário "${username}" já existe.`);
      process.exit(1);
    }
    const avatars = { admin: "👑", editor: "✏️", viewer: "👁️" };
    const name = nameParts.join(" ") || username;
    const id = "user-" + genId();
    db.prepare("INSERT INTO users (id, username, name, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, username.toLowerCase(), name, hashPassword(password), role, avatars[role]);
    console.log(`✅ Usuário "${username}" criado com sucesso (role: ${role})`);
    break;
  }

  case "reset-password": {
    const [username, newPassword] = args;
    if (!username || !newPassword) {
      console.error("Uso: node server/cli.js reset-password <username> <new-password>");
      process.exit(1);
    }
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase());
    if (!user) {
      console.error(`Usuário "${username}" não encontrado.`);
      process.exit(1);
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), user.id);
    console.log(`✅ Senha de "${username}" resetada com sucesso.`);
    break;
  }

  case "change-role": {
    const [username, newRole] = args;
    if (!username || !newRole) {
      console.error("Uso: node server/cli.js change-role <username> <new-role>");
      process.exit(1);
    }
    if (!ROLES.includes(newRole)) {
      console.error(`Role inválida. Use: ${ROLES.join(", ")}`);
      process.exit(1);
    }
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase());
    if (!user) {
      console.error(`Usuário "${username}" não encontrado.`);
      process.exit(1);
    }
    const avatars = { admin: "👑", editor: "✏️", viewer: "👁️" };
    db.prepare("UPDATE users SET role = ?, avatar = ? WHERE id = ?").run(newRole, avatars[newRole], user.id);
    console.log(`✅ Role de "${username}" alterada para "${newRole}".`);
    break;
  }

  case "delete-user": {
    const [username] = args;
    if (!username) {
      console.error("Uso: node server/cli.js delete-user <username>");
      process.exit(1);
    }
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase());
    if (!user) {
      console.error(`Usuário "${username}" não encontrado.`);
      process.exit(1);
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    console.log(`✅ Usuário "${username}" deletado.`);
    break;
  }

  default:
    console.log(`
  Task Hub CLI - Gerenciamento de Usuários
  ─────────────────────────────────────────
  Comandos:
    list-users                              Lista todos os usuários
    create-user <user> <pwd> <role> [name]  Cria um novo usuário
    reset-password <user> <new-pwd>         Reseta a senha
    change-role <user> <new-role>           Muda o role (admin|editor|viewer)
    delete-user <user>                      Deleta um usuário
    `);
}
