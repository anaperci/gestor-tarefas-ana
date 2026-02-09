const { db, hashPassword, genId } = require("./db");

function seed() {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (userCount > 0) {
    console.log("Database already seeded. Skipping.");
    return;
  }

  console.log("Seeding database...");

  // Users
  const insertUser = db.prepare(
    "INSERT INTO users (id, username, name, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertUser.run("user-1", "anapaula", "Ana Paula", hashPassword("padrao@890"), "admin", "👑");
  insertUser.run("user-2", "maria", "Maria Silva", hashPassword("maria123"), "editor", "🎨");
  insertUser.run("user-3", "joao", "João Santos", hashPassword("joao123"), "viewer", "👁️");

  // Projects
  const insertProject = db.prepare(
    "INSERT INTO projects (id, name, color, icon, owner_id) VALUES (?, ?, ?, ?, ?)"
  );
  insertProject.run("proj-1", "PERCI", "#7B61FF", "🚀", "user-1");
  insertProject.run("proj-2", "NexIA Lab", "#00C875", "🤖", "user-1");
  insertProject.run("proj-3", "Imersão 10K", "#FF6B6B", "🔥", "user-1");

  // Project shares
  const insertShare = db.prepare("INSERT INTO project_shares (project_id, user_id) VALUES (?, ?)");
  insertShare.run("proj-1", "user-2");
  insertShare.run("proj-1", "user-3");
  insertShare.run("proj-2", "user-2");

  // Tasks
  const insertTask = db.prepare(
    `INSERT INTO tasks (id, title, description, status, priority, deadline, project_id, assigned_to, created_by, link, checked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const t1 = "task-" + genId();
  insertTask.run(t1, "Gravar vídeo de vendas Imersão 10K",
    "Gravar o vídeo principal de vendas para a página da Imersão 10K com IA.",
    "doing", "critical", "2026-02-15", "proj-3", "user-1", "user-1", "", 0);

  const t2 = "task-" + genId();
  insertTask.run(t2, "Montar knowledge base NexIA", "", "todo", "high",
    "2026-02-20", "proj-2", "user-1", "user-1", "https://nexia.com.br", 0);

  const t3 = "task-" + genId();
  insertTask.run(t3, "Criar prompt de copywriting avançado", "", "backlog", "medium",
    "2026-02-28", "proj-1", "user-1", "user-1", "", 0);

  const t4 = "task-" + genId();
  insertTask.run(t4, "Preparar deck governo", "Deck institucional NexIA Lab.",
    "todo", "high", "2026-03-05", "proj-2", "user-1", "user-1", "", 0);

  // Checklist items
  const insertChecklist = db.prepare(
    "INSERT INTO checklist_items (id, task_id, text, done, sort_order) VALUES (?, ?, ?, ?, ?)"
  );
  insertChecklist.run("cl-" + genId(), t1, "Escrever roteiro", 1, 0);
  insertChecklist.run("cl-" + genId(), t1, "Preparar setup", 0, 1);
  insertChecklist.run("cl-" + genId(), t1, "Gravar", 0, 2);
  insertChecklist.run("cl-" + genId(), t4, "Levantar cases", 0, 0);

  // Subtasks
  const insertSubtask = db.prepare(
    "INSERT INTO subtasks (id, task_id, title, status, checked, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertSubtask.run("st-" + genId(), t1, "Criar thumbnail", "todo", 0, 0);
  insertSubtask.run("st-" + genId(), t1, "Configurar checkout", "doing", 0, 1);
  insertSubtask.run("st-" + genId(), t4, "Revisar dados de ROI", "todo", 0, 0);

  console.log("Seed completed: 3 users, 3 projects, 4 tasks.");
}

seed();
module.exports = { seed };
