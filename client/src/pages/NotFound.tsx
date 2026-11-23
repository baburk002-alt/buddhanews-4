import { Link } from "wouter";
import { CATEGORIES } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { localePath } from "@shared/news";
import { categoryPath } from "@/lib/news";
import { usePageMeta } from "@/hooks/usePageMeta";

export function NotFound() {
  const { t, locale } = useI18n();
  usePageMeta({
    title: `404 — ${t("notFoundTitle")} — Buddha News`,
    description: t("notFoundText"),
    noindex: true,
  });

  return (
    <div className="container-news flex min-h-[62vh] flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-8 flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-brand/30" />
        <div className="absolute inset-4 rounded-full border border-teal/40" />
        <div className="absolute inset-8 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(79,179,170,0.55),rgba(233,162,59,0.25)_60%,transparent_75%)]" />
        <span className="font-display relative text-4xl font-semibold text-foreground">404</span>
      </div>
      <p className="kicker mb-3 text-brand">Buddha News</p>
      <h1 className="headline max-w-2xl text-[clamp(2rem,4.5vw,3.5rem)] text-foreground">{t("notFoundTitle")}</h1>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">{t("notFoundText")}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href={localePath(locale, "/")} className="rounded-md bg-ink px-5 py-2.5 text-sm font-bold text-paper">
          {t("backHome")}
        </Link>
        <Link
          href={localePath(locale, "/search")}
          className="rounded-md border border-line bg-card px-5 py-2.5 text-sm font-bold text-foreground"
        >
          {t("search")}
        </Link>
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {CATEGORIES.slice(0, 6).map(category => (
          <Link
            key={category.key}
            href={categoryPath(locale, category.key)}
            className="rounded-full border border-line px-3 py-1 text-[0.7rem] font-semibold text-muted-foreground hover:border-brand hover:text-brand"
          >
            {category.label[locale]}
          </Link>
        ))}
      </div>
    </div>
  );
}
