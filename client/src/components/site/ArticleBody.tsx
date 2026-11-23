import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

/**
 * Newsroom markdown is authored by authenticated editors, but it is still
 * sanitized before it reaches the DOM. This keeps the article renderer small
 * (no Mermaid/Shiki runtime) and blocks stored XSS if a translation is ever
 * pasted from an untrusted source.
 */
export function ArticleBody({
  content,
  className = "prose-news",
}: {
  content: string | null | undefined;
  className?: string;
}) {
  const html = useMemo(() => {
    const raw = marked.parse(content ?? "", { async: false, gfm: true }) as string;
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [content]);

  if (!content?.trim()) return null;

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
