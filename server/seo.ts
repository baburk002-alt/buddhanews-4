import type { Express, Request, Response } from "express";
import {
  CATEGORIES,
  DEFAULT_LOCALE,
  LOCALES,
  PUBLIC_PAGES,
  getCategory,
  localeHtmlLang,
  localePath,
  splitLocalePath,
  type ArticleDTO,
  type Locale,
} from "../shared/news";
import { getPublicSiteUrl } from "./config";
import * as db from "./db";
import { SITE } from "../shared/news";

export type HtmlTransformResult = { html: string; status: number };
export type HtmlTransform = (html: string, req: Request) => Promise<HtmlTransformResult>;

const SITE_NAME = SITE.name;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/\n/g, " ");
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Canonical origin.
 *
 * In production this is *only* the configured PUBLIC_SITE_URL. The Host header
 * is attacker-controlled and must never end up in a canonical, sitemap or RSS
 * URL — a poisoned host can otherwise poison search indexes. A request-derived
 * origin is allowed solely for local development.
 */
function baseUrl(req?: Request): string {
  const configured = getPublicSiteUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" || !req) return "";
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "http")
    .split(",")[0]
    ?.trim();
  const host = String(req.headers.host ?? "").split(",")[0]?.trim();
  if (!host) return "";
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

function absolute(path: string, req?: Request): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl(req);
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
}

function translationFor(article: ArticleDTO, locale: Locale) {
  return (
    article.translations.find(item => item.locale === locale) ??
    article.translations.find(item => item.locale === "en") ??
    article.translations[0]
  );
}

function localizedSlug(article: ArticleDTO, locale: Locale): string {
  const translation = article.translations.find(item => item.locale === locale);
  return translation?.slug || article.slug;
}

function articlePathFor(article: ArticleDTO, locale: Locale): string {
  return localePath(locale, `/article/${encodeURIComponent(localizedSlug(article, locale))}`);
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphs(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map(block => block.replace(/^#+\s*/, "").replace(/^[-*]\s+/gm, "• ").trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(plainText(block))}</p>`)
    .join("\n");
}

const PAGE_COPY: Record<
  (typeof PUBLIC_PAGES)[number],
  Record<Locale, { title: string; description: string }>
> = {
  about: {
    en: {
      title: "About Buddha Media Group",
      description:
        "Who we are, how the newsroom is funded, and the standards behind our reporting in English, Pashto and Dari.",
    },
    ps: {
      title: "د بدھا میډیا ګروپ په اړه",
      description: "موږ څوک یو، خبریالان څنګه تمویل کیږي او زموږ معیارونه څه دي.",
    },
    fa: {
      title: "درباره گروه رسانه‌ای بدھا",
      description: "ما کی هستیم، چگونه تأمین مالی می‌شویم و معیارهای گزارش‌دهی ما چیست.",
    },
  },
  contact: {
    en: {
      title: "Contact the newsroom",
      description: "Reach the Buddha News desk for corrections, story tips and partnership questions.",
    },
    ps: {
      title: "له خبریالانو سره اړیکه",
      description: "د سمونو، معلوماتو او همکاریو لپاره له بدھا نیوز سره اړیکه ونیسئ.",
    },
    fa: {
      title: "تماس با تحریریه",
      description: "برای اصلاحات، سرنخ‌های خبری و همکاری با بدھا نیوز در تماس شوید.",
    },
  },
  "tip-line": {
    en: {
      title: "Secure tip line",
      description:
        "Send information to Buddha News through a protected form. We never publish a source without consent.",
    },
    ps: {
      title: "خوندي معلوماتي لیکنه",
      description: "خپل معلومات د خوندي فورمې له لارې راولیږئ. موږ سرچینه بې اجازې نه خپروو.",
    },
    fa: {
      title: "خط امن ارسال اطلاعات",
      description: "اطلاعات خود را از طریق فورم امن بفرستید. ما بدون رضایت منبع را نشر نمی‌کنیم.",
    },
  },
  privacy: {
    en: {
      title: "Privacy",
      description:
        "What Buddha News stores, why, how long we keep it, and how to exercise your data rights.",
    },
    ps: {
      title: "محرمیت",
      description: "بدھا نیوز کوم معلومات ساتي، ولې یې ساتي او څنګه خپل حقوق عملي کولی شئ.",
    },
    fa: {
      title: "حریم خصوصی",
      description: "بدھا نیوز چه اطلاعاتی ذخیره می‌کند، چرا و چگونه حقوق خود را اعمال کنید.",
    },
  },
  terms: {
    en: { title: "Terms of use", description: "The rules for using Buddha News and its content." },
    ps: { title: "د کارولو شرایط", description: "د بدھا نیوز او منځپانګې د کارولو مقررات." },
    fa: { title: "شرایط استفاده", description: "قواعد استفاده از بدھا نیوز و محتوای آن." },
  },
  "editorial-policy": {
    en: {
      title: "Editorial policy",
      description:
        "Our corrections policy, AI rules, sourcing standards and the line between reporting and opinion.",
    },
    ps: {
      title: "اداریزه تګلاره",
      description: "د سمونو تګلاره، د مصنوعي ځیرکتیا مقررات او د راپور او نظر ترمنځ توپیر.",
    },
    fa: {
      title: "سیاست تحریریه",
      description: "سیاست اصلاحات، قواعد هوش مصنوعی و مرز میان گزارش و دیدگاه.",
    },
  },
};

const HOME_COPY: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Buddha News — Independent reporting from Afghanistan and the region",
    description:
      "Buddha Media Group reports in English, Pashto and Dari: verified news, investigations, human rights and culture from Afghanistan, Central and South Asia.",
  },
  ps: {
    title: "بدھا نیوز — له افغانستان او سیمې خپلواک راپورونه",
    description:
      "بدھا میډیا ګروپ په انګلیسي، پښتو او دري کې راپورونه وړاندې کوي: تایید شوي خبرونه، څیړنې، بشري حقوق او کلتور.",
  },
  fa: {
    title: "بدھا نیوز — گزارش‌های مستقل از افغانستان و منطقه",
    description:
      "گروه رسانه‌ای بدھا به انگلیسی، پشتو و دری گزارش می‌دهد: خبرهای تأییدشده، پژوهش‌ها، حقوق بشر و فرهنگ.",
  },
};

const SEARCH_COPY: Record<Locale, { title: string; description: string }> = {
  en: { title: "Search the newsroom", description: "Search reporting from Buddha News." },
  ps: { title: "په خبریالانو کې پلټنه", description: "د بدھا نیوز راپورونه وپلټئ." },
  fa: { title: "جستجو در تحریریه", description: "گزارش‌های بدھا نیوز را جستجو کنید." },
};

type Meta = {
  title: string;
  description: string;
  locale: Locale;
  robots?: string;
  type?: "website" | "article";
  image?: string | null;
  urlPath?: string;
  alternates?: Array<{ locale: Locale; path: string }>;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  author?: string | null;
  section?: string | null;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  noscript?: string;
  demo?: boolean;
};

function hreflangTags(meta: Meta, req?: Request): string[] {
  if (!meta.alternates?.length) return [];
  const tags: string[] = [];
  for (const alternate of meta.alternates) {
    const href = absolute(alternate.path, req);
    if (!/^https?:\/\//i.test(href)) continue;
    tags.push(
      `<link rel="alternate" hreflang="${localeHtmlLang(alternate.locale)}" href="${escapeAttr(href)}">`
    );
  }
  const english = meta.alternates.find(item => item.locale === "en") ?? meta.alternates[0];
  if (english) {
    const href = absolute(english.path, req);
    if (/^https?:\/\//i.test(href)) {
      tags.push(`<link rel="alternate" hreflang="x-default" href="${escapeAttr(href)}">`);
    }
  }
  return tags;
}

function renderMeta(meta: Meta, req?: Request): string {
  const tags: string[] = [
    `<meta name="description" content="${escapeAttr(truncate(meta.description, 160))}">`,
  ];
  if (meta.robots) tags.push(`<meta name="robots" content="${escapeAttr(meta.robots)}">`);
  tags.push(`<meta property="og:site_name" content="${SITE_NAME}">`);
  tags.push(`<meta property="og:locale" content="${localeHtmlLang(meta.locale).replace("-", "_")}">`);
  for (const alternate of LOCALES) {
    if (alternate.code !== meta.locale) {
      tags.push(
        `<meta property="og:locale:alternate" content="${localeHtmlLang(alternate.code).replace("-", "_")}">`
      );
    }
  }
  tags.push(`<meta property="og:type" content="${meta.type ?? "website"}">`);
  tags.push(`<meta property="og:title" content="${escapeAttr(truncate(meta.title, 110))}">`);
  tags.push(
    `<meta property="og:description" content="${escapeAttr(truncate(meta.description, 200))}">`
  );
  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  tags.push(`<meta name="twitter:title" content="${escapeAttr(truncate(meta.title, 110))}">`);
  tags.push(
    `<meta name="twitter:description" content="${escapeAttr(truncate(meta.description, 200))}">`
  );

  if (meta.urlPath) {
    const canonical = absolute(meta.urlPath, req);
    if (/^https?:\/\//i.test(canonical)) {
      tags.push(`<link rel="canonical" href="${escapeAttr(canonical)}">`);
      tags.push(`<meta property="og:url" content="${escapeAttr(canonical)}">`);
    }
  }
  tags.push(...hreflangTags(meta, req));

  if (meta.image) {
    const image = absolute(meta.image, req);
    if (/^https?:\/\//i.test(image)) {
      tags.push(`<meta property="og:image" content="${escapeAttr(image)}">`);
      tags.push(`<meta name="twitter:image" content="${escapeAttr(image)}">`);
    }
  }
  if (meta.publishedTime) {
    tags.push(`<meta property="article:published_time" content="${escapeAttr(meta.publishedTime)}">`);
  }
  if (meta.modifiedTime) {
    tags.push(`<meta property="article:modified_time" content="${escapeAttr(meta.modifiedTime)}">`);
  }
  if (meta.author) {
    tags.push(`<meta property="article:author" content="${escapeAttr(meta.author)}">`);
  }
  if (meta.section) {
    tags.push(`<meta property="article:section" content="${escapeAttr(meta.section)}">`);
  }
  if (meta.jsonLd) {
    const json = JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c");
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return tags.join("\n");
}

function apply(html: string, meta: Meta, req?: Request): string {
  let output = html
    .replace(/<html[^>]*>/i, `<html lang="${localeHtmlLang(meta.locale)}" dir="${meta.locale === "en" ? "ltr" : "rtl"}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  output = output.replace(/<meta\s+name="description"[^>]*>/gi, "");
  output = output.replace(/<meta\s+name="robots"[^>]*>/gi, "");
  // The static shell advertises the English feed. Point feed discovery (and
  // the <noscript> fallback link) at the feed of the page's own language.
  output = output.replace(/(href=")\/en\/rss\.xml(")/g, `$1/${meta.locale}/rss.xml$2`);
  output = output.replace("</head>", `${renderMeta(meta, req)}\n</head>`);
  if (meta.noscript) {
    output = output.replace(
      /<div id="root"><\/div>/i,
      `<div id="root"></div>\n<noscript>${meta.noscript}</noscript>`
    );
  }
  return output;
}

function organizationJsonLd(req?: Request) {
  const site = baseUrl(req);
  if (!site) return null;
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE.legalName,
    alternateName: SITE_NAME,
    url: site,
    ...(SITE.email ? { email: SITE.email } : {}),
    knowsLanguage: ["en", "ps", "fa-AF"],
  };
}

function websiteJsonLd(locale: Locale, req?: Request) {
  const site = baseUrl(req);
  if (!site) return null;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${site}/${locale}/`,
    inLanguage: localeHtmlLang(locale),
    publisher: { "@type": "NewsMediaOrganization", name: SITE.legalName, url: site },
    potentialAction: {
      "@type": "SearchAction",
      target: `${site}/${locale}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function breadcrumbJsonLd(items: Array<{ name: string; path: string }>, req?: Request) {
  const site = baseUrl(req);
  if (!site) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${site}${item.path}`,
    })),
  };
}

/** Every language variant of an article that actually exists. */
function articleAlternates(article: ArticleDTO) {
  return LOCALES.filter(locale =>
    article.translations.some(translation => translation.locale === locale.code)
  ).map(locale => ({ locale: locale.code, path: articlePathFor(article, locale.code) }));
}

function staticAlternates(pagePath: string) {
  return LOCALES.map(locale => ({ locale: locale.code, path: localePath(locale.code, pagePath) }));
}

export const transformHtml: HtmlTransform = async (html, req) => {
  let rawPath = req.path;
  try {
    rawPath = new URL(req.originalUrl, "http://localhost").pathname;
  } catch {
    // keep the Express path if the URL is malformed
  }
  const { locale, path } = splitLocalePath(rawPath);

  if (rawPath.startsWith("/admin")) {
    return {
      status: 200,
      html: apply(
        html,
        {
          title: `Newsroom — ${SITE_NAME}`,
          description: "Private Buddha News editorial dashboard.",
          robots: "noindex,nofollow,noarchive",
          locale: "en",
        },
        req
      ),
    };
  }

  const articleMatch = path.match(/^\/article\/([^/]+)\/?$/);
  if (articleMatch) {
    let slug = articleMatch[1]!;
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // keep the raw slug
    }

    const redirect = await db.resolveSlugRedirect(locale, slug).catch(() => null);
    if (redirect) {
      const target = localePath(redirect.locale, `/article/${encodeURIComponent(redirect.slug)}`);
      return { status: 301, html: target };
    }

    try {
      const article = await db.getArticleByLocalizedSlug(locale, slug);
      if (!article) {
        return {
          status: 404,
          html: apply(
            html,
            {
              title: `Story not found — ${SITE_NAME}`,
              description: "The story you requested could not be found.",
              robots: "noindex,follow",
              locale,
              noscript:
                "<h1>404 — story not found</h1><p>This address does not match a published story. <a href=\"/en/\">Return to the front page</a>.</p>",
            },
            req
          ),
        };
      }

      // One canonical address per story and language. A slug from another
      // locale, a legacy base slug or a changed translation redirects before
      // any HTML is emitted, so crawlers never see duplicate content.
      if (!article.translations.some(item => item.locale === locale)) {
        return { status: 301, html: articlePathFor(article, "en") };
      }
      const canonicalPath = articlePathFor(article, locale);
      if (canonicalPath !== localePath(locale, `/article/${encodeURIComponent(slug)}`)) {
        return { status: 301, html: canonicalPath };
      }

      const translation = translationFor(article, locale);
      const title = translation?.title ?? SITE_NAME;
      const description =
        translation?.seoDescription ??
        translation?.summary ??
        truncate(plainText(translation?.content ?? ""), 160);
      const image = article.coverImage ? absolute(article.coverImage, req) : undefined;
      const canonical = absolute(canonicalPath, req);
      const alternates = articleAlternates(article);

      const jsonLd =
        /^https?:\/\//i.test(canonical) && translation
          ? {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: translation.title,
              description,
              image: image ? [image] : undefined,
              datePublished: article.publishedAt ?? undefined,
              dateModified: article.updatedAt ?? article.publishedAt ?? undefined,
              // A desk byline is an organisation, not a person; claiming a
              // Person here would be misleading structured data.
              author: {
                "@type": /desk|newsroom|staff|editorial/i.test(article.authorName)
                  ? "Organization"
                  : "Person",
                name: article.authorName,
              },
              publisher: {
                "@type": "NewsMediaOrganization",
                name: SITE.legalName,
                url: baseUrl(req) || undefined,
              },
              mainEntityOfPage: canonical,
              inLanguage: localeHtmlLang(locale),
              articleSection: article.category,
              isAccessibleForFree: true,
              ...(article.isDemo
                ? {
                    disambiguatingDescription:
                      "Demonstration content supplied with the Buddha News template. Not a factual news report.",
                    creativeWorkStatus: "Demonstration",
                  }
                : {}),
            }
          : null;

      const body = translation?.content ? paragraphs(translation.content) : "";
      const demoNote = article.isDemo
        ? `<p><strong>Demonstration content.</strong> This story is sample material supplied with the site and is not a factual news report.</p>`
        : "";

      return {
        status: 200,
        html: apply(
          html,
          {
            title: `${title} — ${SITE_NAME}`,
            description,
            locale,
            type: "article",
            image: article.coverImage,
            urlPath: canonicalPath,
            alternates,
            publishedTime: article.publishedAt,
            modifiedTime: article.updatedAt,
            author: article.authorName,
            section: article.category,
            jsonLd,
            demo: article.isDemo,
            robots: article.isDemo ? "noindex,follow" : "index,follow,max-image-preview:large",
            noscript: `<article><h1>${escapeHtml(title)}</h1>${demoNote}<p>${escapeHtml(description)}</p>${body}<p><a href="${escapeAttr(canonicalPath)}">Read the full story at Buddha News</a></p></article>`,
          },
          req
        ),
      };
    } catch (error) {
      console.error("[SEO] Article metadata failed", error);
      return { status: 503, html: apply(html, { ...HOME_COPY[locale], locale, robots: "noindex" }, req) };
    }
  }

  const categoryMatch = path.match(/^\/category\/([a-z0-9-]+)\/?$/);
  if (categoryMatch) {
    const category = getCategory(categoryMatch[1]);
    if (!category) {
      return {
        status: 404,
        html: apply(
          html,
          {
            title: `Section not found — ${SITE_NAME}`,
            description: "The section you requested could not be found.",
            robots: "noindex,follow",
            locale,
          },
          req
        ),
      };
    }
    const canonicalPath = localePath(locale, `/category/${category.key}`);
    return {
      status: 200,
      html: apply(
        html,
        {
          title: `${category.label[locale]} — ${SITE_NAME}`,
          description: category.description[locale],
          urlPath: canonicalPath,
          alternates: staticAlternates(`/category/${category.key}`),
          locale,
          jsonLd: breadcrumbJsonLd(
            [
              { name: SITE_NAME, path: `/${locale}/` },
              { name: category.label[locale], path: canonicalPath },
            ],
            req
          ),
        },
        req
      ),
    };
  }

  if (path === "/search") {
    return {
      status: 200,
      html: apply(
        html,
        {
          title: `${SEARCH_COPY[locale].title} — ${SITE_NAME}`,
          description: SEARCH_COPY[locale].description,
          robots: "noindex,follow",
          locale,
          urlPath: localePath(locale, "/search"),
        },
        req
      ),
    };
  }

  const pageKey = path.replace(/^\//, "").replace(/\/$/, "");
  if ((PUBLIC_PAGES as readonly string[]).includes(pageKey)) {
    const copy = PAGE_COPY[pageKey as keyof typeof PAGE_COPY][locale];
    const canonicalPath = localePath(locale, `/${pageKey}`);
    return {
      status: 200,
      html: apply(
        html,
        {
          title: `${copy.title} — ${SITE_NAME}`,
          description: copy.description,
          urlPath: canonicalPath,
          alternates: staticAlternates(`/${pageKey}`),
          locale,
          jsonLd: breadcrumbJsonLd(
            [
              { name: SITE_NAME, path: `/${locale}/` },
              { name: copy.title, path: canonicalPath },
            ],
            req
          ),
        },
        req
      ),
    };
  }

  if (path === "/" || path === "") {
    try {
      const [lead] = await db.listArticles({ limit: 1 });
      return {
        status: 200,
        html: apply(
          html,
          {
            ...HOME_COPY[locale],
            locale,
            urlPath: `/${locale}/`,
            alternates: staticAlternates("/"),
            image: lead?.coverImage ?? null,
            jsonLd: [websiteJsonLd(locale, req), organizationJsonLd(req)].filter(
              Boolean
            ) as Array<Record<string, unknown>>,
          },
          req
        ),
      };
    } catch {
      return {
        status: 200,
        html: apply(
          html,
          { ...HOME_COPY[locale], locale, urlPath: `/${locale}/`, alternates: staticAlternates("/") },
          req
        ),
      };
    }
  }

  // Unknown path: a real 404, never a soft "200 not found".
  return {
    status: 404,
    html: apply(
      html,
      {
        title: `Page not found — ${SITE_NAME}`,
        description: "The page you requested could not be found.",
        robots: "noindex,follow",
        locale,
      },
      req
    ),
  };
};

/* ------------------------------------------------------------------ */
/* Redirects                                                           */
/* ------------------------------------------------------------------ */

const LEGACY_PREFIXES: Array<{ pattern: RegExp; target: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /^\/article\/([^/]+)\/?$/,
    target: match => `/en/article/${encodeURIComponent(decodeURIComponent(match[1]!))}`,
  },
  {
    pattern: /^\/category\/([a-z0-9-]+)\/?$/,
    target: match => `/en/category/${match[1]}`,
  },
];

/**
 * Language routing and legacy URL preservation.
 *
 * `/` and every pre-localization URL permanently redirect to the `/en/`
 * equivalent so existing links, bookmarks and search results keep working.
 */
export function registerLocaleRedirects(app: Express) {
  app.get("/", (req, res) => {
    const preferred = pickLocale(req);
    res.redirect(302, `/${preferred}/`);
  });

  app.get(/^\/(en|ps|fa)$/, (req, res) => {
    res.redirect(301, `${req.path}/`);
  });

  for (const page of PUBLIC_PAGES) {
    app.get(`/${page}`, (_req, res) => res.redirect(301, `/en/${page}`));
  }
  app.get("/search", (_req, res) => res.redirect(301, "/en/search"));

  app.get(LEGACY_PREFIXES[0]!.pattern, (req, res) => {
    const match = LEGACY_PREFIXES[0]!.pattern.exec(req.path);
    if (!match) return res.redirect(301, "/en/");
    res.redirect(301, LEGACY_PREFIXES[0]!.target(match));
  });

  app.get(LEGACY_PREFIXES[1]!.pattern, (req, res) => {
    const match = LEGACY_PREFIXES[1]!.pattern.exec(req.path);
    if (!match) return res.redirect(301, "/en/");
    res.redirect(301, LEGACY_PREFIXES[1]!.target(match));
  });

  app.get(["/rss.xml", "/feed.xml"], (_req, res) => res.redirect(302, "/en/rss.xml"));
}

/** Cookie preference first, then Accept-Language, then English. */
function pickLocale(req: Request): Locale {
  const cookieHeader = String(req.headers.cookie ?? "");
  const match = /(?:^|;\s*)bn-locale=(en|ps|fa)/.exec(cookieHeader);
  if (match) return match[1] as Locale;
  const header = String(req.headers["accept-language"] ?? "");
  const parts = header
    .split(",")
    .map(part => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: (tag ?? "").toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter(entry => entry.tag)
    .sort((a, b) => b.q - a.q);
  for (const part of parts) {
    if (part.tag === "ps" || part.tag.startsWith("ps-")) return "ps";
    if (part.tag === "fa" || part.tag.startsWith("fa-") || part.tag.startsWith("prs")) return "fa";
    if (part.tag === "en" || part.tag.startsWith("en-")) return "en";
  }
  return DEFAULT_LOCALE;
}

/* ------------------------------------------------------------------ */
/* robots.txt, sitemaps, RSS                                           */
/* ------------------------------------------------------------------ */

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (req, res) => {
    const base = baseUrl(req);
    const lines = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /api/",
      "Disallow: /search",
      "Disallow: /en/search",
      "Disallow: /ps/search",
      "Disallow: /fa/search",
      base ? `Sitemap: ${base}/sitemap.xml` : "# Set PUBLIC_SITE_URL to publish the sitemap address",
    ];
    res.type("text/plain").send(`${lines.join("\n")}\n`);
  });

  app.get("/sitemap.xml", (req, res) => {
    const base = baseUrl(req);
    if (!base) {
      res.status(503).type("text/plain").send("PUBLIC_SITE_URL is not configured");
      return;
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${LOCALES.map(
  locale => `  <sitemap><loc>${escapeHtml(`${base}/sitemap-${locale.code}.xml`)}</loc></sitemap>`
).join("\n")}
</sitemapindex>`;
    res.type("application/xml").send(xml);
  });

  const serveLocaleSitemap = async (locale: Locale, req: Request, res: Response) => {
    const base = baseUrl(req);
    if (!base) {
      res.status(503).type("text/plain").send("PUBLIC_SITE_URL is not configured");
      return;
    }
    try {
      const articles = await db.listSitemapArticles();
      const entries: Array<{ loc: string; lastmod: string | null; alternates: Array<{ hreflang: string; href: string }> }> = [];

      const staticPaths = ["/", "/search"].filter(path => path !== "/search");
      for (const page of PUBLIC_PAGES) staticPaths.push(`/${page}`);
      for (const path of staticPaths) {
        entries.push({
          loc: `${base}${localePath(locale, path)}`,
          lastmod: null,
          alternates: LOCALES.map(item => ({
            hreflang: localeHtmlLang(item.code),
            href: `${base}${localePath(item.code, path)}`,
          })),
        });
      }
      for (const category of CATEGORIES) {
        entries.push({
          loc: `${base}${localePath(locale, `/category/${category.key}`)}`,
          lastmod: null,
          alternates: LOCALES.map(item => ({
            hreflang: localeHtmlLang(item.code),
            href: `${base}${localePath(item.code, `/category/${category.key}`)}`,
          })),
        });
      }
      for (const article of articles) {
        if (!article.translations.some(item => item.locale === locale)) continue;
        const slug =
          article.translations.find(item => item.locale === locale)?.slug || article.slug;
        const alternates = article.translations
          .filter(item => item.slug || item.locale === "en")
          .map(item => ({
            hreflang: localeHtmlLang(item.locale),
            href: `${base}${localePath(item.locale, `/article/${encodeURIComponent(item.slug || article.slug)}`)}`,
          }));
        entries.push({
          loc: `${base}${localePath(locale, `/article/${encodeURIComponent(slug)}`)}`,
          lastmod: (article.updatedAt ?? article.publishedAt)?.toISOString() ?? null,
          alternates,
        });
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    entry =>
      `  <url><loc>${escapeHtml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}${entry.alternates
        .map(
          alternate =>
            `<xhtml:link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(alternate.href)}"/>`
        )
        .join("")}</url>`
  )
  .join("\n")}
</urlset>`;
      res.type("application/xml").send(xml);
    } catch (error) {
      console.error("[SEO] Sitemap failed", error);
      res.status(500).type("text/plain").send("Sitemap unavailable");
    }
  };

  // Canonical sitemap URLs are /sitemap-<locale>.xml. The locale-prefixed
  // aliases are accepted too, so a crawler that guesses /en/sitemap.xml still
  // gets the right document instead of the HTML 404 page.
  app.get(/^\/sitemap-(en|ps|fa)\.xml$/, (req, res) => {
    const locale = req.path.match(/^\/sitemap-(en|ps|fa)\.xml$/)?.[1] as Locale | undefined;
    if (!locale) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    void serveLocaleSitemap(locale, req, res);
  });
  app.get(/^\/(en|ps|fa)\/sitemap\.xml$/, (req, res) => {
    const locale = req.path.split("/")[1] as Locale;
    void serveLocaleSitemap(locale, req, res);
  });

  app.get(/^\/(en|ps|fa)\/rss\.xml$/, async (req, res) => {
    const locale = req.path.split("/")[1] as Locale;
    try {
      // Demonstration stories stay in the feed only when labelled. They are
      // excluded from sitemaps and marked noindex on their pages, so search
      // engines never treat them as reporting.
      const articles = await db.listArticles({ limit: 30 });
      const base = baseUrl(req);
      const items = articles
        .map(article => {
          const translation = translationFor(article, locale);
          if (!translation) return "";
          const link = `${base}${articlePathFor(article, locale)}`;
          const title = article.isDemo ? `[Demonstration] ${translation.title}` : translation.title;
          return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${escapeHtml(link)}</link>
      <guid isPermaLink="true">${escapeHtml(link)}</guid>
      <description>${escapeHtml(translation.summary ?? "")}</description>
      <pubDate>${article.publishedAt ? new Date(article.publishedAt).toUTCString() : ""}</pubDate>
    </item>`;
        })
        .filter(Boolean)
        .join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(SITE_NAME)}</title>
    <link>${escapeHtml(`${base}/${locale}/`)}</link>
    <description>Independent reporting from Afghanistan, Central and South Asia.${articles.some(article => article.isDemo) ? " Items marked [Demonstration] are sample content, not reporting." : ""}</description>
    <language>${localeHtmlLang(locale)}</language>
${items}
  </channel>
</rss>`;
      res.type("application/rss+xml").send(xml);
    } catch (error) {
      console.error("[SEO] RSS failed", error);
      res.status(500).type("text/plain").send("Feed unavailable");
    }
  });
}
