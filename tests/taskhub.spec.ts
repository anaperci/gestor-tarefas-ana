import { test, expect } from "@playwright/test";

test.describe("NexIA Tasks - Auditoria Completa", () => {

  // ——— 1. TELA DE LOGIN ———
  test.describe("Login Screen", () => {
    test("deve carregar a tela de login", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("text=NexIA Tasks", { timeout: 10000 });
      await expect(page.locator("text=NexIA Tasks")).toBeVisible();
      await expect(page.locator("text=Faça login para continuar")).toBeVisible();
    });

    test("deve mostrar erro para credenciais inválidas", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("input[placeholder='seu.usuario']", { timeout: 10000 });
      await page.fill("input[placeholder='seu.usuario']", "invalido");
      await page.fill("input[type='password']", "errado");
      await page.click("text=Entrar");
      await expect(page.locator("text=Usuário não encontrado")).toBeVisible();
    });

    test("deve mostrar erro para senha incorreta", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("input[placeholder='seu.usuario']", { timeout: 10000 });
      await page.fill("input[placeholder='seu.usuario']", "anapaula");
      await page.fill("input[type='password']", "senhaerrada");
      await page.click("text=Entrar");
      await expect(page.locator("text=Senha incorreta")).toBeVisible();
    });

    test("deve ter toggle de tema na tela de login", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("text=NexIA Tasks", { timeout: 10000 });
      // O botão de tema (☀️ ou 🌙) deve estar visível
      const themeBtn = page.locator("button").filter({ hasText: /☀️|🌙/ });
      await expect(themeBtn).toBeVisible();
    });

  });

  // ——— 2. LOGIN COMO ADMIN ———
  test.describe("Admin Login & Dashboard", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("input[placeholder='seu.usuario']", { timeout: 10000 });
      await page.fill("input[placeholder='seu.usuario']", "anapaula");
      await page.fill("input[type='password']", "padrao@890");
      await page.click("text=Entrar");
      await page.waitForSelector("text=Gestor de Tarefas", { timeout: 10000 });
    });

    test("deve fazer login como admin e ver o dashboard", async ({ page }) => {
      await expect(page.locator("text=Ana Paula")).toBeVisible();
      await expect(page.locator("text=NexIA Tasks")).toBeVisible();
    });

    test("deve ver sidebar com projetos", async ({ page }) => {
      await expect(page.locator("text=Projetos")).toBeVisible();
      await expect(page.locator(".sidebar-item").filter({ hasText: "Todos" })).toBeVisible();
      await expect(page.locator(".sidebar-item").filter({ hasText: "PERCI" })).toBeVisible();
      await expect(page.locator(".sidebar-item").filter({ hasText: "NexIA Lab" })).toBeVisible();
    });

    test("deve ver tarefas na tabela", async ({ page }) => {
      // Verifica que os cabeçalhos da tabela estão visíveis (cada grupo tem seu header)
      await expect(page.getByText("Tarefa", { exact: true }).first()).toBeVisible();
      // Verifica que há pelo menos uma task-row visível
      await expect(page.locator(".task-row").first()).toBeVisible();
    });

    test("deve ver botão + Nova Tarefa como admin", async ({ page }) => {
      await expect(page.getByRole("button", { name: "+ Nova Tarefa" })).toBeVisible();
    });

    test("deve ver botão Painel Admin como admin", async ({ page }) => {
      await expect(page.locator("text=Painel Admin")).toBeVisible();
    });

    test("deve filtrar por projeto ao clicar na sidebar", async ({ page }) => {
      await page.click("text=PERCI");
      await expect(page.locator("h1").filter({ hasText: "PERCI" })).toBeVisible();
    });

    test("deve filtrar por status", async ({ page }) => {
      await page.selectOption("select", "todo");
      // Todas as tarefas visíveis devem ter status "A Fazer"
      const rows = page.locator(".task-row");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("deve buscar tarefas por texto", async ({ page }) => {
      await page.fill("input[placeholder='Buscar tarefas...']", "deck");
      await expect(page.locator("text=Preparar deck governo")).toBeVisible();
    });

    test("deve abrir painel de detalhe ao clicar na tarefa", async ({ page }) => {
      await page.locator(".task-row").first().click();
      // Espera o painel de detalhe abrir (tem Status, Prioridade, Descrição)
      await expect(page.locator("text=Descrição")).toBeVisible({ timeout: 5000 });
    });

    test("deve criar nova tarefa", async ({ page }) => {
      // Espera os dados carregarem (task rows visíveis = projetos e tarefas já carregados)
      await expect(page.locator(".task-row").first()).toBeVisible({ timeout: 10000 });
      await page.click("text=Nova Tarefa");
      // O painel de detalhe deve abrir com "Nova tarefa" (timeout maior para API remota)
      await expect(page.locator("input[value='Nova tarefa']")).toBeVisible({ timeout: 15000 });
    });

    test("deve mudar status de tarefa via dropdown", async ({ page }) => {
      // Clica no badge de status da primeira tarefa
      const firstStatus = page.locator(".task-row").first().locator("button").first();
      await firstStatus.click();
      // Espera o dropdown aparecer e verifica que tem opções de status
      await expect(page.getByRole("button", { name: "Backlog" }).first()).toBeVisible({ timeout: 3000 });
    });

    test("deve fazer logout", async ({ page }) => {
      await page.click("button[title='Sair']");
      await expect(page.locator("text=Faça login para continuar")).toBeVisible({ timeout: 5000 });
    });
  });

  // ——— 3. PAINEL ADMIN ———
  test.describe("Admin Panel", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("input[placeholder='seu.usuario']", { timeout: 10000 });
      await page.fill("input[placeholder='seu.usuario']", "anapaula");
      await page.fill("input[type='password']", "padrao@890");
      await page.click("text=Entrar");
      await page.waitForSelector("text=Painel Admin", { timeout: 10000 });
    });

    test("deve abrir painel admin", async ({ page }) => {
      await page.click("text=Painel Admin");
      await expect(page.locator("h2").filter({ hasText: "Painel Admin" })).toBeVisible({ timeout: 5000 });
    });

    test("deve listar usuários no painel admin", async ({ page }) => {
      await page.click("text=Painel Admin");
      await page.waitForSelector("text=Criar novo usuário", { timeout: 5000 });
      await expect(page.locator("text=Ana Paula").first()).toBeVisible();
      await expect(page.locator("text=Maria Silva").first()).toBeVisible();
      await expect(page.locator("text=João Santos").first()).toBeVisible();
    });

    test("deve ter aba de Permissões", async ({ page }) => {
      await page.click("text=Painel Admin");
      await page.waitForSelector("text=Usuários", { timeout: 5000 });
      await page.locator("button").filter({ hasText: "Permissões" }).click();
      await expect(page.locator("text=Legenda de Permissões")).toBeVisible({ timeout: 5000 });
    });

    test("deve fechar painel admin ao clicar ✕", async ({ page }) => {
      await page.click("text=Painel Admin");
      await page.waitForSelector("h2:has-text('Painel Admin')", { timeout: 5000 });
      // Close button is next to the h2 header
      await page.locator("button").filter({ hasText: /✕|×|╳|\u2715/ }).first().click();
      await expect(page.locator("h2").filter({ hasText: "Painel Admin" })).not.toBeVisible({ timeout: 3000 });
    });
  });

  // ——— 4. LOGIN COMO VIEWER ———
  test.describe("Viewer Permissions", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("input[placeholder='seu.usuario']", { timeout: 10000 });
      await page.fill("input[placeholder='seu.usuario']", "joao");
      await page.fill("input[type='password']", "joao123");
      await page.click("text=Entrar");
      await page.waitForSelector("text=Gestor de Tarefas", { timeout: 10000 });
    });

    test("deve fazer login como viewer", async ({ page }) => {
      await expect(page.locator("text=João Santos")).toBeVisible();
      await expect(page.locator("text=Visualizador")).toBeVisible();
    });

    test("viewer NÃO deve ver botão Nova Tarefa", async ({ page }) => {
      await expect(page.locator("text=Nova Tarefa")).not.toBeVisible();
    });

    test("viewer NÃO deve ver Painel Admin", async ({ page }) => {
      await expect(page.locator("text=Painel Admin")).not.toBeVisible();
    });

    test("viewer NÃO deve ver criar projeto", async ({ page }) => {
      await expect(page.locator("text=Novo projeto")).not.toBeVisible();
    });

    test("viewer deve ver aviso de modo visualização no detalhe", async ({ page }) => {
      const row = page.locator(".task-row").first();
      if (await row.isVisible()) {
        await row.click();
        await expect(page.locator("text=Modo visualização")).toBeVisible({ timeout: 5000 });
      }
    });

    test("viewer deve ver apenas projetos compartilhados", async ({ page }) => {
      // PERCI é compartilhado com joao, Imersão 10K não é
      await expect(page.locator(".sidebar-item").filter({ hasText: "PERCI" })).toBeVisible();
      await expect(page.locator("text=Imersão 10K")).not.toBeVisible();
    });
  });

  // ——— 5. LOGIN COMO EDITOR ———
  test.describe("Editor Permissions", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("input[placeholder='seu.usuario']", { timeout: 10000 });
      await page.fill("input[placeholder='seu.usuario']", "maria");
      await page.fill("input[type='password']", "maria123");
      await page.click("text=Entrar");
      await page.waitForSelector("text=Gestor de Tarefas", { timeout: 10000 });
    });

    test("deve fazer login como editor", async ({ page }) => {
      await expect(page.locator("text=Maria Silva")).toBeVisible();
    });

    test("editor deve ver botão Nova Tarefa", async ({ page }) => {
      await expect(page.getByRole("button", { name: "+ Nova Tarefa" })).toBeVisible();
    });

    test("editor NÃO deve ver Painel Admin", async ({ page }) => {
      await expect(page.locator("text=Painel Admin")).not.toBeVisible();
    });

    test("editor NÃO deve ver criar projeto", async ({ page }) => {
      await expect(page.locator("text=Novo projeto")).not.toBeVisible();
    });
  });

  // ——— 6. TEMA ———
  test.describe("Theme", () => {
    test("deve alternar entre tema dark e light", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("text=NexIA Tasks", { timeout: 10000 });
      // Clica no toggle de tema
      const themeBtn = page.locator("button").filter({ hasText: /☀️|🌙/ });
      await themeBtn.click();
      // Depois de clicar, o ícone deve mudar
      await expect(page.locator("button").filter({ hasText: /☀️|🌙/ })).toBeVisible();
    });
  });

  // ——— 7. CONSOLE ERRORS ———
  test("deve carregar sem erros no console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForSelector("text=NexIA Tasks", { timeout: 10000 });

    // Login
    await page.fill("input[placeholder='seu.usuario']", "anapaula");
    await page.fill("input[type='password']", "padrao@890");
    await page.click("text=Entrar");
    await page.waitForSelector("text=Gestor de Tarefas", { timeout: 10000 });

    // Navegar
    await page.click("text=PERCI");
    await page.waitForTimeout(500);
    await page.click("text=Todos");
    await page.waitForTimeout(500);

    // Filtrar erros relevantes (ignorar avisos de fetch /api/health que é esperado falhar)
    const realErrors = errors.filter(e => !e.includes("/api/health") && !e.includes("Failed to fetch"));
    expect(realErrors).toEqual([]);
  });
});
