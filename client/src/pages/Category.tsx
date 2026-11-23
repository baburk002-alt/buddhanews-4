import { Link, useParams, useSearch } from "wouter";
import { getCategory } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { categoryDescription, categoryPath, subcategoriesFor } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { ArticleCard } from "@/components/site/ArticleCard";
import { EmptyState, ErrorState } from "@/components/site/PageState";
import { NotFound } from "./NotFound";

export default function Category() {
  const params = useParams<{ key: string }>();
  const search = useSearch();
  const key = params.key ?? "";
  const category = getCategory(key);
  const activeSub = new URLSearchParams(search).get("sub");
  const { t, locale } = useI18n();

  usePageMeta({
    title: category ? `${category.label[locale]} — Buddha News` : "Section — Buddha News",
    description: category?.description[locale],
    noindex: !category,
  });

  const query = trpc.articles.list.useQuery(
    { category: key, limit: 40 },
    { enabled: Boolean(category), staleTime: 60_000 }
  );

  if (!category) return <NotFound />;

  const all = query.data ?? [];
  const subcategories = subcategoriesFor(key);
  const validSub = subcategories.some(sub => sub.key === activeSub);
  const articles = validSub ? all.filter(article => article.subcategory === activeSub) : all;
  const [lead, ...rest] = articles;

  return (
    <div>
      <header
        className="border-b border-line py-10 lg:py-14"
        style={{
          background: `radial-gradient(800px 300px at 15% 0%, color-mix(in srgb, ${category.accent} 13%, transparent), transparent 70%)`,
        }}
      >
        <div className="container-news">
          <p className="kicker mb-3" style={{ color: category.accent }}>
            {t("sections")}
          </p>
          <h1 className="headline text-[clamp(2.3rem,5.5vw,4.5rem)] text-foreground">
            {category.label[locale]}
          </h1>
          <p className="mt-3 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">
            {categoryDescription(key, locale)}
          </p>

          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label={t("filters")}>
            <Link
              href={categoryPath(locale, key)}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                !validSub
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-card text-muted-foreground hover:border-brand"
              }`}
              aria-current={!validSub ? "page" : undefined}
            >
              {t("all")}
            </Link>
            {subcategories.map(sub => (
              <Link
                key={sub.key}
                href={categoryPath(locale, key, sub.key)}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                  activeSub === sub.key
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-card text-muted-foreground hover:border-brand"
                }`}
                aria-current={activeSub === sub.key ? "page" : undefined}
              >
                {sub.label[locale]}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="container-news py-10">
        {query.isLoading && (
          <div role="status" aria-busy="true" aria-label={t("loading")} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(index => (
              <div key={index} className="space-y-3">
                <div className="skeleton aspect-[16/10] rounded-lg" />
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-7 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {query.error && <ErrorState headingLevel={2} message={query.error.message} onRetry={() => query.refetch()} />}

        {!query.isLoading && !query.error && articles.length === 0 && (
          <EmptyState
            title={t("noResults")}
            text={t("searchNoResultsHint")}
            action={
              <Link href={categoryPath(locale, key)} className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 py-2 text-xs font-bold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                {t("all")}
              </Link>
            }
          />
        )}

        {lead && (
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <ArticleCard article={lead} variant="hero" eager showSummary headingAs="h2" />
            <div className="rounded-lg border border-line bg-card px-5">
              {rest.slice(0, 5).map((article, index) => (
                <ArticleCard key={article.id} article={article} variant="compact" index={index} />
              ))}
            </div>
          </div>
        )}

        {rest.length > 5 && (
          <div className="mt-10 grid gap-6 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.slice(5).map((article, index) => (
              <ArticleCard key={article.id} article={article} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
