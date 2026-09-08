import sanitize from "sanitize-html";
export function safeHtml(value: string): string {
  return sanitize(value, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "hr", "a", "span", "code", "pre", "div"],
    allowedAttributes: { a: ["href", "target", "rel"], span: ["data-user-id", "class"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitize.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}
