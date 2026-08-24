import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

/** Documento de uma linha do cabeçalho. */
function campo(rotulo: string, valor: string): string {
  return `<tr><th>${rotulo}</th><td>${valor || "—"}</td></tr>`;
}

function formatarData(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

/**
 * GET /api/tasks/[id]/export
 * Devolve o conteúdo da tarefa como documento pronto para impressão/PDF.
 * O navegador abre a janela de impressão sozinho (?print=1), e o usuário
 * salva em PDF — sem depender de biblioteca de PDF no servidor.
 */
export const GET = withErrorHandling(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, deadline, project_id, assigned_to")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");

  const { data: project } = await supabase
    .from("projects")
    .select("name, workspace_id")
    .eq("id", task.project_id)
    .maybeSingle();

  const { data: workspace } = project?.workspace_id
    ? await supabase.from("workspaces").select("name").eq("id", project.workspace_id).maybeSingle()
    : { data: null };

  const { data: assignee } = task.assigned_to
    ? await supabase.from("users").select("name").eq("id", task.assigned_to).maybeSingle()
    : { data: null };

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("text, done, sort_order")
    .eq("task_id", id)
    .order("sort_order");

  const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const titulo = escapar(task.title);

  const listaChecklist = (checklist ?? []).length
    ? `<section class="checklist">
         <h2>Checklist</h2>
         <ul>${(checklist ?? []).map((c) => `<li class="${c.done ? "feito" : ""}"><span class="box">${c.done ? "✓" : ""}</span>${escapar(c.text)}</li>`).join("")}</ul>
       </section>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${titulo}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1a1a1a; line-height: 1.65; font-size: 11.5pt; margin: 0; }
  .doc { max-width: 760px; margin: 0 auto; padding: 24px; }
  header { border-bottom: 3px solid #0F4C5C; padding-bottom: 14px; margin-bottom: 20px; }
  header h1 { font-size: 19pt; margin: 0 0 4px; color: #0F4C5C; letter-spacing: -0.3px; }
  table.meta { width: 100%; border-collapse: collapse; margin-bottom: 26px; }
  table.meta th { text-align: left; width: 150px; padding: 5px 10px 5px 0; color: #5a6a6f;
                  font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700;
                  vertical-align: top; }
  table.meta td { padding: 5px 0; font-weight: 600; }
  .conteudo h2 { font-size: 13.5pt; color: #0F4C5C; margin: 22px 0 6px; padding-top: 10px;
                 border-top: 1px solid #e4e8e9; page-break-after: avoid; }
  .conteudo h3 { font-size: 12pt; color: #0F4C5C; margin: 18px 0 4px; page-break-after: avoid; }
  .conteudo h4 { font-size: 11.5pt; margin: 14px 0 4px; page-break-after: avoid; }
  .conteudo p { margin: 0 0 9px; }
  .conteudo ul, .conteudo ol { margin: 6px 0 10px 20px; }
  .conteudo li { margin: 3px 0; }
  .conteudo blockquote { margin: 10px 0; padding: 8px 14px; border-left: 3px solid #0F4C5C;
                         background: #f2f7f8; color: #3d4d52; }
  .conteudo a { color: #0F4C5C; }
  .conteudo hr { border: none; border-top: 1px solid #dde3e4; margin: 16px 0; }
  .checklist { margin-top: 26px; page-break-before: auto; }
  .checklist h2 { font-size: 13.5pt; color: #0F4C5C; border-top: 1px solid #e4e8e9; padding-top: 10px; }
  .checklist ul { list-style: none; padding: 0; margin: 8px 0 0; }
  .checklist li { display: flex; gap: 9px; align-items: baseline; margin: 5px 0; }
  .checklist .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #7d8f95;
                    border-radius: 3px; text-align: center; line-height: 12px; font-size: 10px;
                    color: #0F4C5C; flex-shrink: 0; }
  .checklist li.feito { color: #6b7a7f; text-decoration: line-through; }
  footer { margin-top: 34px; padding-top: 10px; border-top: 1px solid #e4e8e9;
           font-size: 8.5pt; color: #8a999e; display: flex; justify-content: space-between; }
  @media print { .doc { padding: 0; } a { text-decoration: none; } }
</style></head>
<body>
  <div class="doc">
    <header>
      <h1>${titulo}</h1>
    </header>
    <table class="meta">
      ${campo("Projeto", escapar(workspace?.name ?? ""))}
      ${campo("Campanha", escapar(project?.name ?? ""))}
      ${campo("Tarefa", titulo)}
      ${campo("Data de Entrega", formatarData(task.deadline || ""))}
      ${campo("Responsável", escapar(assignee?.name ?? ""))}
    </table>
    <div class="conteudo">${task.description || "<p>Sem conteúdo.</p>"}</div>
    ${listaChecklist}
    <footer>
      <span>Clareza · ${escapar(workspace?.name ?? "")}</span>
      <span>${new Date().toLocaleDateString("pt-BR")}</span>
    </footer>
  </div>
  <script>
    if (new URLSearchParams(location.search).get("print") === "1") {
      window.addEventListener("load", () => window.print());
    }
  </script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
});
