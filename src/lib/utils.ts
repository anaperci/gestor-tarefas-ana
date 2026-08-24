import crypto from "crypto";

export function genId(): string {
  return crypto.randomBytes(4).toString("hex");
}

/** Escapa HTML antes de qualquer conversão — o texto colado é conteúdo, não markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Formatação inline: **negrito**, *itálico*, `código` e URLs soltas. */
function inlineMarkdown(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Converte o markdown que sai de ChatGPT/Claude/Gemini no HTML que o editor
 * de descrição entende. Sem isso, colar um roteiro de anúncios vira um
 * parágrafo único com "###" e "**" crus no meio do texto.
 */
export function markdownToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;

  const closeList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { closeList(); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 4); // # vira h2 (h1 é o título da tarefa)
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line)) { closeList(); out.push("<hr>"); continue; }

    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      continue;
    }

    const quote = /^>\s+(.*)$/.exec(line);
    if (quote) {
      closeList();
      out.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    closeList();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return out.join("");
}
