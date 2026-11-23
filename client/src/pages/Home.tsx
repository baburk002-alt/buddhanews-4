import { lazy, Suspense } from "react";
import { ArrowUpRight, Play, Sparkles } from "lucide-react";
import { Link } from "wouter";
import type { ArticleDTO } from "@shared/news";
import { getCategory, localePath } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { askBuddhaAI } from "@/lib/ai";
import { articlePath, articleTitle, categoryPath, coverImage } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { ArticleCard } from "@/components/site/ArticleCard";
import { EmptyState, ErrorState } from "@/components/site/PageState";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { SectionHeading } from "@/components/site/SectionHeading";
const GlobeScene = lazy(() =>
  import("@/components/three/GlobeScene").then(module => ({ default: module.GlobeScene }))
);

function CategoryBand({
  categoryKey,
  articles,
  muted = false,
}: {
  categoryKey: string;
  articles: ArticleDTO[];
  muted?: boolean;
}) {
  const { locale, t } = useI18n();
  const category = getCategory(categoryKey);
  const list = articles.filter(article => article.category === categoryKey).slice(0, 4);
  if (!category || list.length === 0) return null;
  const [first, ...rest] = list;
  if (!first) return null;

  return (
    <section className={muted ? "border-t border-line bg-muted/30 py-12" : "border-t border-line py-12"}>
      <div className="container-news">
        <SectionHeading
          title={category.label[locale]}
          href={categoryPath(locale, category.key)}
          linkLabel={t("allStories")}
        />
        <div className={rest.length > 0 ? "grid gap-7 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]" : "grid gap-7"}>
          <ArticleCard article={first} variant="horizontal" eager={false} />
          {rest.length > 0 && (
            <div className="rounded-lg border border-line bg-card px-5">
              {rest.map((article, index) => (
                <ArticleCard key={article.id} article={article} variant="compact" index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function VideoStrip({ articles }: { articles: ArticleDTO[] }) {
  const { locale, t } = useI18n();
  const videos = articles.filter(article => article.category === "videos").slice(0, 3);
  if (videos.length === 0) return null;
  return (
    <section className="border-t border-line py-12">
      <div className="container-news">
        <SectionHeading
          kicker={t("video")}
          title={getCategory("videos")?.label[locale] ?? t("video")}
          href={categoryPath(locale, "videos")}
          linkLabel={t("allStories")}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          {videos.map(article => (
            <Link
              key={article.id}
              href={articlePath(locale, article)}
              className="group block overflow-hidden rounded-lg border border-line bg-card"
            >
              <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={coverImage(article)}
                  alt={article.coverAlt ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform group-hover:scale-110">
                    <Play className="ms-0.5 h-5 w-5 fill-current" />
                  </span>
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-semibold leading-snug text-foreground group-hover:text-brand">
                  {articleTitle(article, locale)}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t, locale, formatDate } = useI18n();
  usePageMeta({
    title: "Buddha News — Independent reporting from Afghanistan and the region",
    description:
      "Buddha Media Group reports in English, Pashto and Dari: verified news, investigations, human rights and culture from Afghanistan, Central and South Asia.",
  });

  const articlesQuery = trpc.articles.list.useQuery({ limit: 40 }, { staleTime: 60_000 });
  const mostReadQuery = trpc.articles.mostRead.useQuery(undefined, { staleTime: 60_000 });
  const settingsQuery = trpc.settings.public.useQuery(undefined, { staleTime: 300_000 });

  if (articlesQuery.isLoading) {
    return (
      <div className="container-news grid gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr]" role="status" aria-busy="true">
        <span className="sr-only">{t("loading")}</span>
        <div className="space-y-4">
          <div className="skeleton h-5 w-32 rounded" />
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-12 w-4/5 rounded" />
          <div className="skeleton aspect-[16/9] w-full rounded-lg" />
        </div>
        <div className="skeleton min-h-[420px] rounded-lg" />
      </div>
    );
  }

  if (articlesQuery.error) {
    return <ErrorState message={articlesQuery.error.message} onRetry={() => articlesQuery.refetch()} />;
  }

  const articles = articlesQuery.data ?? [];
  if (articles.length === 0) {
    return (
      <div className="container-news py-16">
        <EmptyState
          title={t("firstEditionTitle")}
          text={t("firstEditionText")}
          action={
            <Link href="/admin" className="rounded-md bg-ink px-5 py-2.5 text-sm font-bold text-paper">
              {t("openNewsroom")}
            </Link>
          }
        />
      </div>
    );
  }

  const lead = articles.find(article => article.featured) ?? articles[0]!;
  const secondary = articles.filter(article => article.id !== lead.id).slice(0, 4);
  const latest = articles.filter(article => article.id !== lead.id).slice(4, 10);
  const mostRead = mostReadQuery.data && mostReadQuery.data.length > 0 ? mostReadQuery.data : articles.slice(0, 5);
  const opinion = articles.filter(article => article.category === "opinion").slice(0, 4);
  const liveStream = settingsQuery.data?.liveStreamUrl;

  return (
    <>
      {articles.some(article => article.isDemo) && (
        <div className="border-b border-amber-500/40 bg-amber-500/10">
          <div className="container-news flex flex-col gap-0.5 py-2.5 text-[0.72rem] sm:flex-row sm:items-center sm:gap-2">
            <span className="font-extrabold text-foreground">{t("demoHomeTitle")}</span>
            <span className="leading-relaxed text-muted-foreground">{t("demoHomeBody")}</span>
          </div>
        </div>
      )}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(1000px 460px at 88% -5%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 65%)",
        }}
      >
        <div className="container-news grid items-stretch gap-8 py-8 sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:py-14">
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="rounded-sm bg-brand px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-foreground">
                {t("briefing")}
              </span>
              <span className="text-[0.72rem] font-semibold text-muted-foreground">
                <bdi>{formatDate(new Date())}</bdi> · {t("latest")}
              </span>
            </div>
            <ArticleCard article={lead} variant="hero" eager showSummary headingAs="h1" />
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={categoryPath(locale, "afghanistan")}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-xs font-extrabold text-paper transition-opacity hover:opacity-85"
              >
                {t("latest")} <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => askBuddhaAI()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-card px-4 text-xs font-extrabold text-foreground transition-colors hover:border-brand"
              >
                <Sparkles className="h-3.5 w-3.5 text-brand" /> {t("askAi")}
              </button>
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-[#2a333d] bg-[#0b1015] sm:min-h-[400px] lg:h-[clamp(30rem,45vw,37rem)] lg:min-h-[480px] lg:self-start">
            <Suspense fallback={<div className="absolute inset-0 bg-[#101820]" aria-hidden="true" />}>
              <GlobeScene className="absolute inset-0 h-full w-full" />
            </Suspense>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 45%, transparent 35%, rgba(11,16,21,0.55) 100%)",
              }}
              aria-hidden="true"
            />
            <div className="absolute start-5 top-5 flex items-center gap-2 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-[#f6f1e8]">
              <span className="pulse-dot h-2 w-2 rounded-full bg-[#e9a23b]" aria-hidden="true" />
              {t("liveDesk")}
            </div>
            <div className="absolute end-5 top-5 text-end font-mono text-[0.62rem] leading-relaxed text-[#a7b0ba]">
              <span dir="ltr" className="block">34.53°N<br />69.17°E</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1015] via-[#0b1015]/85 to-transparent p-5 pt-16">
              <p className="kicker mb-2 text-[#e9a23b]"><bdi dir="ltr">Kabul · Doha · Islamabad · Delhi</bdi></p>
              <p className="max-w-sm text-sm leading-relaxed text-[#f6f1e8]/75">
                {t("globeText")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {liveStream ? (
                  <a
                    href={liveStream}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center gap-2 rounded bg-[#e9a23b] px-3 text-[0.7rem] font-extrabold text-[#1c1305]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> {t("watchLive")}
                  </a>
                ) : (
                  <Link
                    href={categoryPath(locale, "videos")}
                    className="inline-flex min-h-11 items-center gap-2 rounded bg-[#e9a23b] px-3 text-[0.7rem] font-extrabold text-[#1c1305]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> {t("watchLive")}
                  </Link>
                )}
                <span className="text-[0.66rem] font-semibold text-[#a7b0ba]">
                  EN · پښتو · دری
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-news py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,330px)]">
          <div className="min-w-0">
            <SectionHeading kicker={t("latestKicker")} title={t("latest")} href={localePath(locale, "/search")} linkLabel={t("search")} />
            <div className="grid gap-6 sm:grid-cols-2">
              {[...secondary, ...latest].slice(0, 6).map((article, index) => (
                <ArticleCard key={article.id} article={article} index={index} />
              ))}
            </div>
          </div>
          <aside className="space-y-6">
            <div>
              <SectionHeading kicker={t("recordKicker")} title={t("mostRead")} />
              <ol role="list" className="list-none rounded-lg border border-line bg-card px-4 py-2">
                {mostRead.map((article, index) => (
                  <li key={article.id} className="border-b border-line last:border-0">
                    <ArticleCard article={article} variant="numbered" index={index} />
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-lg border border-brand/35 bg-brand/10 p-5">
              <Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />
              <h3 className="font-display mt-3 text-xl font-semibold text-foreground">{t("askTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("askIntro")}
              </p>
              <button
                type="button"
                onClick={() => askBuddhaAI()}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-3 text-xs font-extrabold text-paper"
              >
                {t("askAi")} <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </div>
          </aside>
        </div>
      </section>

      <CategoryBand categoryKey="afghanistan" articles={articles} />
      <CategoryBand categoryKey="world" articles={articles} muted />
      <CategoryBand categoryKey="business" articles={articles} />

      {opinion.length > 0 && (
        <section className="border-y border-[#2a333d] bg-[#151a20] py-12 text-[#f6f1e8]">
          <div className="container-news">
            <div className="mb-7 flex items-end justify-between gap-4 border-b border-[#2a333d] pb-4">
              <div>
                <p className="kicker mb-2 text-[#e9a23b]">{t("opinionKicker")}</p>
                <h2 className="headline text-[clamp(1.6rem,3vw,2.25rem)]">{t("opinion")}</h2>
              </div>
              <Link href={categoryPath(locale, "opinion")} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[#e9a23b]">
                {t("allStories")} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {opinion.map((article, index) => (
                <ArticleCard key={article.id} article={article} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CategoryBand categoryKey="sports" articles={articles} muted />
      <CategoryBand categoryKey="culture" articles={articles} />
      <CategoryBand categoryKey="specials" articles={articles} muted />
      <VideoStrip articles={articles} />

      <section className="border-t border-line py-12">
        <div className="container-news">
          <div className="grid items-center gap-8 rounded-xl border border-line bg-card p-6 lg:grid-cols-[1fr_1fr] lg:p-10">
            <div>
              <p className="kicker mb-3 text-brand">Buddha AI</p>
              <h2 className="headline text-[clamp(1.8rem,3.6vw,2.8rem)] text-foreground">
                {t("aiSectionTitle")}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t("aiSectionText")}
              </p>
              <p className="mt-4 text-[0.7rem] leading-relaxed text-muted-foreground">{t("aiDisclaimer")}</p>
            </div>
            <div className="grid gap-2">
              {[t("suggestion1"), t("suggestion2"), t("suggestion3"), t("suggestion4")].map(question => (
                <button
                  key={question}
                  type="button"
                  onClick={() => askBuddhaAI({ question })}
                  className="flex items-center justify-between gap-3 rounded-md border border-line bg-background px-4 py-3 text-start text-sm font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  {question}
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-brand rtl:-scale-x-100" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-brand py-12 text-brand-foreground">
        <div className="container-news grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="kicker mb-3">{t("newsletterTitle")}</p>
            <h2 className="headline text-[clamp(1.9rem,3.6vw,3rem)]">{t("newsletterTitle")}</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed">{t("newsletterText")}</p>
          </div>
          <div className="rounded-lg bg-background p-5 text-foreground shadow-sm">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
