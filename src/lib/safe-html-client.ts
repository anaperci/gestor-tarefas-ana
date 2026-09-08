"use client";
import DOMPurify from "dompurify";
export function safeClientHtml(value: string): string {
  return typeof window === "undefined" ? "" : DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "hr", "a", "span", "code", "pre", "div"],
    ALLOWED_ATTR: ["href", "target", "rel", "data-user-id", "class"],
  });
}
