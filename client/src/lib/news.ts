import type { ArticleDTO, ArticleTranslationDTO, Locale } from "@shared/news";
import {
  categoryLabel,
  categoryUrl,
  getCategory,
  getSubcategory,
  localePath,
  subcategoryLabel,
  type PublicPage,
} from "@shared/news";

export function pickTranslation(
  article: Pick<ArticleDTO, "translations">,
  locale: Locale
): { translation: ArticleTranslationDTO | null; isFallback: boolean } {
  const exact = article.translations.find(item => item.locale === locale);
  if (exact) return { translation: exact, isFallback: false };
  const english = article.translations.find(item => item.locale === "en");
  return { translation: english ?? article.translations[0] ?? null, isFallback: true };
}

export function articleTitle(article: ArticleDTO, locale: Locale): string {
  return pickTranslation(article, locale).translation?.title ?? "Untitled story";
}

export function articleSummary(article: ArticleDTO, locale: Locale): string {
  return pickTranslation(article, locale).translation?.summary ?? "";
}

export function categoryName(key: string, locale: Locale): string {
  return categoryLabel(key, locale);
}

export function subcategoryName(
  categoryKey: string,
  subKey: string | null | undefined,
  locale: Locale
): string {
  return subcategoryLabel(categoryKey, subKey, locale);
}

export function categoryDescription(key: string, locale: Locale): string {
  return getCategory(key)?.description[locale] ?? "";
}

export function subcategoriesFor(key: string) {
  return getCategory(key)?.subcategories ?? [];
}

/** The localized slug for a story, falling back to the canonical slug. */
export function localizedSlugFor(article: ArticleDTO, locale: Locale): string {
  return article.translations.find(item => item.locale === locale)?.slug || article.slug;
}

export function articlePath(locale: Locale, article: Pick<ArticleDTO, "slug" | "translations">): string {
  const slug = article.translations.find(item => item.locale === locale)?.slug || article.slug;
  return localePath(locale, `/article/${encodeURIComponent(slug)}`);
}

/** For places that only have a slug (sharing, redirects). */
export function articlePathBySlug(locale: Locale, slug: string): string {
  return localePath(locale, `/article/${encodeURIComponent(slug)}`);
}

export function categoryPath(locale: Locale, key: string, sub?: string | null): string {
  return categoryUrl(locale, key, sub);
}

export function pagePath(locale: Locale, page: PublicPage): string {
  return localePath(locale, `/${page}`);
}

export function coverImage(article: ArticleDTO): string {
  return article.coverImage || "/og-fallback.svg";
}

export function readTimeLabel(minutes: number, t: (key: "minRead") => string): string {
  return `${minutes} ${t("minRead")}`;
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function estimateReadMinutes(markdown: string): number {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 210));
}

export function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
