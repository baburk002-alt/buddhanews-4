import { useEffect, useState, type FormEvent } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { CATEGORIES, localePath } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { categoryPath } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { ArticleCard } from "@/components/site/ArticleCard";
import { EmptyState, ErrorState } from "@/components/site/PageState";

export default function Search() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { t, locale } = useI18n();
  const initial = new URLSearchParams(search).get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const activeQuery = new URLSearchParams(search).get("q") ?? "";

  useEffect(() => {
    setQuery(activeQuery);
  }, [activeQuery]);

  usePageMeta({
    title: `${t("searchTitle")} — Buddha News`,
    description: t("searchHint"),
    noindex: true,
  });

  const results = trpc.articles.list.useQuery(
    { search: activeQuery, limit: 40 },
    { enabled: activeQuery.trim().length >= 2, staleTime: 30_000 }
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    const path = localePath(locale, "/search");
    navigate(trimmed ? `${path}?q=${encodeURIComponent(trimmed)}` : path);
  }

  return (
    <div>
      <header className="border-b border-line py-10 lg:py-14">
        <div className="container-news">
          <p className="kicker mb-3 text-brand">{t("search")}</p>
          <h1 className="headline text-[clamp(2.2rem,5vw,4rem)] text-foreground">{t("searchTitle")}</h1>
          <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl gap-2" role="search">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("searchPlaceholder")}</span>
                <SearchIcon className="pointer-events-none absolute inset-y-0 start-4 my-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                dir="auto"
                placeholder={t("searchPlaceholder")}
                className="h-12 w-full rounded-md border border-line bg-card ps-12 pe-4 text-base text-foreground focus:border-brand"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 items-center rounded-md bg-ink px-5 text-sm font-extrabold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {t("search")}
            </button>
          </form>
        </div>
      </header>

      <div className="container-news py-10">
        {activeQuery.trim().length < 2 && (
          <div>
            <p className="text-sm text-muted-foreground">{t("searchHint")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORIES.map(category => (
                <Link
                  key={category.key}
                  href={categoryPath(locale, category.key)}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {category.label[locale]}
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeQuery.trim().length >= 2 && results.isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label={t("loading")}>
            {[0, 1, 2, 3, 4, 5].map(index => (
              <div key={index} className="space-y-3">
                <div className="skeleton aspect-[16/10] rounded-lg" />
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-7 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {activeQuery.trim().length >= 2 && results.error && (
          <ErrorState headingLevel={2} message={results.error.message} onRetry={() => results.refetch()} />
        )}

        {activeQuery.trim().length >= 2 && !results.isLoading && results.data && (
          <>
            <p className="mb-6 text-sm font-semibold text-muted-foreground" role="status" aria-live="polite">
              <span className="text-foreground">{results.data.length}</span> {t("searchResults")} · “{activeQuery}”
            </p>
            {results.data.length === 0 ? (
              <EmptyState title={t("noResults")} text={t("searchNoResultsHint")} />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <h2 className="sr-only">{t("searchResults")}</h2>
                {results.data.map((article, index) => (
                  <ArticleCard key={article.id} article={article} index={index} headingAs="h2" />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
