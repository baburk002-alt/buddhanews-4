import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, MapPin, Newspaper } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { trpc } from "@/lib/trpc";
import { ArticleCard } from "@/components/site/ArticleCard";
import { EmptyState, ErrorState } from "@/components/site/PageState";
import { localePath } from "@shared/news";

export function reporterSlugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "reporter"
  );
}

export default function Reporter() {
  const params = useParams<{ slug?: string }>();
  const slug = decodeURIComponent(params.slug || "").toLowerCase();
  const { locale, t } = useI18n();

  const articlesQuery = trpc.articles.list.useQuery({ limit: 100 }, { staleTime: 60_000 });
  const allArticles = articlesQuery.data ?? [];

  const reporterArticles = useMemo(() => {
    return allArticles.filter(
      a => reporterSlugFromName(a.authorName || "Buddha Newsroom") === slug
    );
  }, [allArticles, slug]);

  const firstArticle = reporterArticles[0];
  const reporterName = firstArticle?.authorName || decodeURIComponent(params.slug || "Reporter").replace(/-/g, " ");
  const reporterAvatar = (firstArticle as { authorAvatar?: string | null } | undefined)?.authorAvatar || null;
  const reporterLocation = (firstArticle as { authorLocation?: string | null } | undefined)?.authorLocation || null;
  const reporterBio =
    (firstArticle as { authorBio?: string | null } | undefined)?.authorBio ||
    "Correspondent and contributor reporting for Buddha Media Group across the region.";

  const initials = reporterName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");

  usePageMeta({
    title: `${reporterName} — Buddha News`,
    description: reporterBio,
    image: reporterAvatar,
  });

  return (
    <div className="container-news py-10">
      <div className="mb-6">
        <Link
          href={localePath(locale, "/")}
          className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("home")}
        </Link>
      </div>

      <section className="rounded-xl border border-line bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {reporterAvatar ? (
            <img
              src={reporterAvatar}
              alt={reporterName}
              className="h-24 w-24 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-ink text-2xl font-extrabold text-paper">
              {initials || "BN"}
            </div>
          )}

          <div className="flex-1">
            <p className="kicker text-[0.65rem] text-brand">{t("by")}</p>
            <h1 className="headline mt-1 text-3xl text-foreground sm:text-4xl">{reporterName}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
              {reporterLocation && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                  {reporterLocation}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Newspaper className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                {reporterArticles.length} {reporterArticles.length === 1 ? "Report" : "Reports"}
              </span>
            </div>

            <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {reporterBio}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="headline mb-6 text-2xl text-foreground sm:text-3xl">
          Reports by {reporterName}
        </h2>

        {articlesQuery.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="skeleton h-64 rounded-lg" />
            <div className="skeleton h-64 rounded-lg" />
            <div className="skeleton h-64 rounded-lg" />
          </div>
        ) : articlesQuery.isError ? (
          <ErrorState
            title="Unable to load reports"
            description="Please refresh the page to try again."
            onRetry={() => articlesQuery.refetch()}
          />
        ) : reporterArticles.length === 0 ? (
          <EmptyState
            title="No published reports found for this reporter yet"
            description="Published stories assigned to this reporter will appear here."
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reporterArticles.map((article, index) => (
              <ArticleCard key={article.id} article={article} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
