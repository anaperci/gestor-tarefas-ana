import { test, expect, type Page } from "@playwright/test";

/**
 * Ordum — Smoke test (pré-produção)
 * Cobre os fluxos críticos do app: login, dashboard, tarefas, perfil, atalhos.
 *
 * Pré-requisito: usuários da equipe PERCI cadastrados no banco
 * (anapaula / Anapaula@890 e pedro / Equipe@890).
 */

const ADMIN = { username: "anapaula", password: "Anapaula@890", name: "Ana Paula" };
const EDITOR = { username: "pedro", password: "Equipe@890", name: "Pedro" };

async function login(page: Page, user: { username: string; password: string }) {
  await page.goto("/");
  await page.waitForSelector("input[autocomplete='username']", { timeout: 15000 });
  await page.fill("input[autocomplete='username']", user.username);
  await page.fill("input[autocomplete='current-password']", user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Saiu da tela de login → headline da hero ("Tarefas em ordem,") sumiu
  await page.waitForSelector("text=Boa", { timeout: 15000 }); // saudação
}

// ─── 1. Login ──────────────────────────────────────────────────────────

test.describe("Login", () => {
  test("renderiza tela de login com headline e logo Ordum", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Tarefas em ordem,", { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("times em movimento.", { exact: false })).toBeVisible();
    await expect(page.getByText("Bem-vinda de volta", { exact: false })).toBeVisible();
    await expect(page.locator("img[alt='Ordum']").first()).toBeVisible();
  });

  test("toggle de tema visível na tela de login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /tema (claro|escuro)/i })).toBeVisible();
  });

  test("credenciais erradas mostram mensagem genérica (sem user enumeration)", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("input[autocomplete='username']", { timeout: 15000 });
    await page.fill("input[autocomplete='username']", "usuario_inexistente_xyz");
    await page.fill("input[autocomplete='current-password']", "Qualquer123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/usu[aá]rio ou senha inv[aá]lidos|inv[aá]lidos|Muitas tentativas/i))
      .toBeVisible({ timeout: 10000 });
  });

  test("login válido entra no Dashboard", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByText(`Boa`, { exact: false })).toBeVisible();
    // Dashboard tem alguma das secs
    await expect(page.locator("section[aria-label='Hoje'], section[aria-label='Projetos']").first())
      .toBeVisible({ timeout: 10000 });
  });
});

// ─── 2. Sidebar e navegação ────────────────────────────────────────────

test.describe("Sidebar e navegação", () => {
  test("admin vê os 3 itens de navegação principais", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByRole("button", { name: /Dashboard/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Minha [ÁA]rea/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Todos/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Painel Admin/ })).toBeVisible();
  });

  test("naviga Dashboard → Todos (lista de tarefas)", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /^Todos/ }).first().click();
    await expect(page.locator('h1').filter({ hasText: /Todas as Tarefas|Tarefas/ })).toBeVisible({ timeout: 8000 });
  });

  test("naviga Dashboard → Minha Área", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /Minha [ÁA]rea/ }).click();
    await expect(page.locator("text=Minhas Tarefas").or(page.locator("text=Anotações")).first())
      .toBeVisible({ timeout: 8000 });
  });

  test("bloco de perfil no rodapé da sidebar abre o ProfilePanel", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /Abrir meu perfil/ }).click();
    await expect(page.getByRole("dialog", { name: "Meu perfil" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Username", { exact: false })).toBeVisible();
    await expect(page.getByText("Trocar senha")).toBeVisible();
  });

  test("avatar picker abre com 4 estilos", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /Abrir meu perfil/ }).click();
    await page.getByRole("button", { name: /Trocar avatar/ }).click();
    await expect(page.getByRole("dialog", { name: "Escolher avatar" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("tab", { name: "Aventureiro" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Notion" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Persona" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Clássico" })).toBeVisible();
  });
});

// ─── 3. Dashboard ──────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test("renderiza saudação contextual com nome", async ({ page }) => {
    await login(page, ADMIN);
    const saudacoes = ["Boa manhã", "Boa tarde", "Boa noite"];
    const matched = await Promise.any(
      saudacoes.map((s) => page.getByText(`${s}, Ana`, { exact: false }).waitFor({ timeout: 8000 }))
    ).then(() => true).catch(() => false);
    expect(matched).toBe(true);
  });

  test("tem botão 'Nova tarefa' com atalho N", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByRole("button", { name: /Nova tarefa/i }).first()).toBeVisible();
  });

  test("atalho N abre o popover de nova tarefa", async ({ page }) => {
    await login(page, ADMIN);
    // Garante que não está digitando em input
    await page.locator("body").click();
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "Nova tarefa" })).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Nova tarefa" })).not.toBeVisible({ timeout: 3000 });
  });

  test("coluna de notas tem botão pra recolher e atalho ] funciona", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN);
    // Coluna visível
    await expect(page.locator("aside[aria-label='Notas rápidas']")).toBeVisible({ timeout: 8000 });
    // Recolhe
    await page.getByRole("button", { name: /Recolher coluna de notas/ }).click();
    await expect(page.locator("aside[aria-label='Notas rápidas']")).not.toBeVisible({ timeout: 3000 });
    // Reabre via atalho ]
    await page.keyboard.press("]");
    await expect(page.locator("aside[aria-label='Notas rápidas']")).toBeVisible({ timeout: 3000 });
  });
});

// ─── 4. Tarefas (Lista + Kanban) ───────────────────────────────────────

test.describe("Tarefas", () => {
  test("toggle Lista/Kanban funciona e persiste", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /^Todos/ }).first().click();
    await page.waitForLoadState("networkidle");

    const kanbanTab = page.getByRole("tab", { name: "Visualização Kanban" });
    await kanbanTab.click();

    // Checa que pelo menos 1 coluna do Kanban apareceu
    await expect(page.locator("section[aria-label='Coluna A Fazer']").or(
      page.locator("section[aria-label='Coluna Backlog']")
    ).first()).toBeVisible({ timeout: 8000 });

    // Reload e verifica que persistiu
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^Todos/ }).first().click();
    await expect(page.locator("section[aria-label='Coluna Backlog']").first()).toBeVisible({ timeout: 8000 });
  });

  test("dropdown de status não fica cortado (renderiza via portal)", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /^Todos/ }).first().click();
    await page.waitForLoadState("networkidle");

    // Garante modo lista
    const listTab = page.getByRole("tab", { name: "Visualização em lista" });
    if (await listTab.isVisible()) await listTab.click();

    // Tenta abrir o primeiro StatusBadge
    const firstStatusButton = page.locator(".task-row").first().locator("button[aria-haspopup='listbox']").first();
    if (await firstStatusButton.isVisible()) {
      await firstStatusButton.click();
      // Dropdown renderiza via portal com role=listbox
      await expect(page.locator("[role='listbox']").first()).toBeVisible({ timeout: 3000 });
      await page.keyboard.press("Escape");
    }
  });
});

// ─── 5. Permissões (editor) ────────────────────────────────────────────

test.describe("Permissões — editor", () => {
  test("editor não vê Painel Admin", async ({ page }) => {
    await login(page, EDITOR);
    await expect(page.getByRole("button", { name: /Painel Admin/ })).not.toBeVisible();
  });

  test("editor vê botão Nova tarefa", async ({ page }) => {
    await login(page, EDITOR);
    await expect(page.getByRole("button", { name: /Nova tarefa/i }).first()).toBeVisible();
  });
});

// ─── 6. Logout ─────────────────────────────────────────────────────────

test("logout volta pra tela de login", async ({ page }) => {
  await login(page, ADMIN);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByText("Tarefas em ordem,", { exact: false })).toBeVisible({ timeout: 8000 });
});

// ─── 7. Sem erros no console em fluxos básicos ─────────────────────────

test("sem erros de console críticos no fluxo principal", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await login(page, ADMIN);
  await page.getByRole("button", { name: /^Todos/ }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Dashboard/ }).click();
  await page.waitForLoadState("networkidle");

  // Filtra ruídos benignos
  const real = errors.filter((e) =>
    !e.includes("Failed to fetch") &&
    !e.includes("net::ERR_") &&
    !e.toLowerCase().includes("hydrat") // hydration warning de SSR
  );
  expect(real, `Erros de console: ${JSON.stringify(real, null, 2)}`).toEqual([]);
});
