import { Link } from "wouter";
import { getCategory } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { useReveal } from "@/lib/useReveal";
import {
  articlePath,
  articleSummary,
  articleTitle,
  categoryName,
  coverImage,
  pickTranslation,
  subcategoryName,
} from "@/lib/news";
import { cn } from "@/lib/utils";
import type { ArticleDTO } from "@shared/news";

type Variant = "standard" | "hero" | "horizontal" | "compact" | "numbered";

type ArticleCardProps = {
  article: ArticleDTO;
  variant?: Variant;
  index?: number;
  className?: string;
  eager?: boolean;
  showSummary?: boolean;
  /** Heading element for the title. Defaults to h3; the home hero passes h1. */
  headingAs?: "h1" | "h2" | "h3";
};

export function ArticleCard({
  article,
  variant = "standard",
  index = 0,
  className,
  eager = false,
  showSummary,
  headingAs: Heading = "h3",
}: ArticleCardProps) {
  const { locale, t, formatDate, formatNumber } = useI18n();
  const reveal = useReveal<HTMLElement>(index);
  const { translation, isFallback } = pickTranslation(article, locale);
  const title = articleTitle(article, locale);
  const summary = articleSummary(article, locale);
  const category = categoryName(article.category, locale);
  const sub = subcategoryName(article.category, article.subcategory, locale);
  const accent = getCategory(article.category)?.accent ?? "var(--brand)";
  const image = coverImage(article);
  const date = formatDate(article.publishedAt);
  const showSum = showSummary ?? (variant === "hero" || variant === "horizontal");
  const fallbackLanguage = isFallback && translation
    ? { lang: translation.locale === "fa" ? "fa-AF" : translation.locale, dir: translation.locale === "en" ? "ltr" as const : "rtl" as const }
    : {};

  if (variant === "compact") {
    return (
      <article {...reveal} className={cn("group border-b border-line py-4 last:border-0", className)}>
        <Link href={articlePath(locale, article)} className="grid grid-cols-[minmax(0,92px)_minmax(0,1fr)] gap-4">
          <div className="aspect-square overflow-hidden rounded-md bg-muted">
            <img
              src={image}
              alt={article.coverAlt ?? ""}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0">
            <p className="kicker mb-1.5 flex flex-wrap items-center gap-1.5 text-[0.62rem] text-brand">
              {category}
              {article.isDemo && (
                <span className="rounded-sm border border-amber-500/50 px-1 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {t("demoBadge")}
                </span>
              )}
            </p>
            <h3 {...fallbackLanguage} className="font-display text-[1.02rem] font-semibold leading-snug text-foreground transition-colors group-hover:text-brand">
              {title}
            </h3>
            <p className="mt-2 text-[0.7rem] font-medium text-muted-foreground">
              <bdi>{date}</bdi> · {article.readMinutes} {t("minRead")}
            </p>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === "numbered") {
    return (
      <article {...reveal} className={cn("group flex gap-4 py-4", className)}>
        <span className="font-display text-[2rem] leading-none text-brand tabular-nums" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <Link href={articlePath(locale, article)}>
            <h3 {...fallbackLanguage} className="font-display text-[1.05rem] font-semibold leading-snug text-foreground transition-colors group-hover:text-brand">
              {title}
            </h3>
          </Link>
          <p className="mt-1.5 text-[0.7rem] font-medium text-muted-foreground">
            {category} · {formatNumber(article.views)} {t("views")}
          </p>
        </div>
      </article>
    );
  }

  const imageLink = (
    <Link
      href={articlePath(locale, article)}
      className={cn(
        "image-zoom relative block overflow-hidden bg-muted",
        variant === "hero" ? "mt-6 aspect-[16/9] rounded-lg" : "aspect-[16/10]",
        variant === "horizontal" && "h-full min-h-[220px] sm:aspect-auto"
      )}
      aria-label={title}
      {...fallbackLanguage}
    >
      <img
        src={image}
        alt={article.coverAlt ?? ""}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        className="h-full w-full object-cover"
      />
      <span
        className="absolute inset-x-0 bottom-0 h-1 opacity-90"
        style={{ background: accent }}
        aria-hidden="true"
      />
    </Link>
  );

  return (
    <article
      {...reveal}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-card",
        variant !== "hero" && "card-lift",
        variant === "horizontal" && "sm:grid sm:grid-cols-[1.1fr_1fr]",
        variant === "hero" && "border-0 bg-transparent",
        className
      )}
    >
      {variant !== "hero" && imageLink}
      <div className={cn("flex min-w-0 flex-1 flex-col p-5", variant === "hero" && "flex-none p-0")}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="kicker text-[0.64rem] text-brand">
            {category}
          </span>
          {sub && (
            <>
              <span className="text-muted-foreground/50" aria-hidden="true">/</span>
              <span className="text-[0.68rem] font-semibold text-muted-foreground">{sub}</span>
            </>
          )}
          {article.isDemo && (
            <span className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {t("demoBadge")}
            </span>
          )}
          {isFallback && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
              {translation?.locale.toUpperCase()}
            </span>
          )}
        </div>
        <Link href={articlePath(locale, article)}>
          <Heading
            {...fallbackLanguage}
            className={cn(
              "font-display font-semibold leading-[1.15] text-foreground transition-colors group-hover:text-brand",
              variant === "hero"
                ? "text-[clamp(2rem,4.4vw,3.5rem)]"
                : "text-[1.22rem]"
            )}
          >
            {title}
          </Heading>
        </Link>
        {showSum && summary && (
          <p {...fallbackLanguage} className={cn("mt-3 text-[0.95rem] leading-relaxed text-muted-foreground", variant === "hero" && "max-w-2xl text-[1.02rem]")}>
            {summary}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-[0.7rem] font-semibold text-muted-foreground">
          <bdi>{date}</bdi>
          <span aria-hidden="true">·</span>
          <span>
            {article.readMinutes} {t("minRead")}
          </span>
          {translation && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t("by")} <bdi>{article.authorName}</bdi></span>
            </>
          )}
        </div>
      </div>
      {variant === "hero" && imageLink}
    </article>
  );
}
