import { useEffect } from "react";

type PageMeta = {
  title: string;
  description?: string;
  image?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
};

function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

/**
 * Keeps title, description and social tags in sync during client navigation.
 *
 * Canonical URLs, hreflang and JSON-LD stay server-owned so they never point at
 * a preview host. Robots handling is deliberately one-way: the client may add
 * `noindex` (for an error state) but can never remove a directive the server
 * emitted — a published page that is noindexed on the server must stay that
 * way after hydration.
 */
export function usePageMeta({ title, description, image, type = "website", noindex }: PageMeta) {
  useEffect(() => {
    document.title = title;
    if (description) {
      upsertMeta('meta[name="description"]', "name", "description", description);
      upsertMeta('meta[property="og:description"]', "property", "og:description", description);
      upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    }
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[property="og:type"]', "property", "og:type", type);

    const existing = document.head
      .querySelector<HTMLMetaElement>('meta[name="robots"]')
      ?.getAttribute("content")
      ?.toLowerCase();
    const serverBlocksIndexing = Boolean(existing && /noindex|none/.test(existing));

    if (serverBlocksIndexing) {
      // Never loosen a server directive.
      return;
    }
    if (noindex) {
      upsertMeta('meta[name="robots"]', "name", "robots", "noindex,nofollow");
    }
    // When the server said "index" we leave it untouched: the client has no
    // authority to change crawl directives.
  }, [title, description, image, type, noindex]);

  useEffect(() => {
    if (!image) return;
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
  }, [image]);
}
