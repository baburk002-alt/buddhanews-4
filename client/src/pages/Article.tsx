import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Eye, Headphones, Loader2, Sparkles, VolumeX } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { getCategory, localePath } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { reporterSlugFromName } from "./Reporter";
import { askBuddhaAI } from "@/lib/ai";
import {
  articlePath,
  categoryName,
  categoryPath,
  coverImage,
  pagePath,
  pickTranslation,
  stripMarkdown,
  subcategoryName,
} from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { ArticleCard } from "@/components/site/ArticleCard";
import { ErrorState } from "@/components/site/PageState";
import { ReadingProgress } from "@/components/site/ReadingProgress";
import { ShareButtons } from "@/components/site/ShareButtons";
import { ArticleBody } from "@/components/site/ArticleBody";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { NotFound } from "./NotFound";
import { SPEECH_LANG, useSpeechSupport } from "@/lib/speechVoices";

export default function Article() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const [location, setLocation] = useLocation();
  const { t, locale, setLocale, formatDate, formatNumber } = useI18n();
  const query = trpc.articles.get.useQuery(
    { slug, locale },
    { enabled: Boolean(slug), retry: false }
  );
  const view = trpc.articles.view.useMutation();
  const briefMutation = trpc.articles.aiSummary.useMutation();
  const [brief, setBrief] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  // Hide the Listen button unless the device has a voice for this language.
  const speech = useSpeechSupport(locale);
  const viewedRef = useRef<string | null>(null);

  const article = query.data?.article;
  const { translation, isFallback } = article
    ? pickTranslation(article, locale)
    : { translation: null, isFallback: false };

  usePageMeta({
    title: article && translation ? `${translation.title} — Buddha News` : "Story — Buddha News",
    description:
      translation?.summary ??
      translation?.seoDescription ??
      "Independent reporting from Buddha Media Group.",
    image: article?.coverImage ?? null,
    type: "article",
    noindex: Boolean(query.error),
  });

  // Language switching keeps the reader on the same story. When a
  // translation exists the URL is rewritten to its localized slug so the
  // address bar, canonical link and share buttons always agree.
  useEffect(() => {
    if (!article) return;
    const target = articlePath(locale, article);
    if (decodeURI(location) !== decodeURI(target)) {
      setLocation(target, { replace: true });
    }
  }, [article, locale, location, setLocation]);
  useEffect(() => {
    if (!article) return;
    const key = `${article.id}-${locale}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    view.mutate({ id: article.id, locale });
  }, [article, locale, view]);

  useEffect(() => {
    // Stop reading when the language (and therefore the text and voice) changes
    // or the reader leaves the story.
    setSpeaking(false);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [locale, slug]);

  if (query.isLoading) {
    return (
      <div className="container-news py-12" role="status" aria-busy="true" aria-label={t("loading")}>
        <span className="sr-only">{t("loading")}</span>
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-14 w-full rounded" />
          <div className="skeleton h-14 w-4/5 rounded" />
          <div className="skeleton aspect-[16/9] w-full rounded-lg" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-11/12 rounded" />
        </div>
      </div>
    );
  }

  if (query.error) {
    if (query.error.data?.code === "NOT_FOUND") return <NotFound />;
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }

  if (!article || !translation) return <NotFound />;

  const articleSlug = article.slug;
  const category = getCategory(article.category);
  const categoryLabel = categoryName(article.category, locale);
  const subLabel = subcategoryName(article.category, article.subcategory, locale);
  const image = coverImage(article);
  const reporterAvatar = (article as { authorAvatar?: string | null } | undefined)?.authorAvatar || null;
  const reporterLocation = (article as { authorLocation?: string | null } | undefined)?.authorLocation || null;
  const reporterBio =
    (article as { authorBio?: string | null } | undefined)?.authorBio ||
    "Reporting for Buddha Media Group across the region.";
  const reporterHref = localePath(locale, `/reporter/${encodeURIComponent(reporterSlugFromName(article.authorName || "Buddha Newsroom"))}`);

  const initials = article.authorName
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const summary = brief ?? translation.aiSummary ?? null;

  function toggleSpeech() {
    if (!("speechSynthesis" in window) || !speech.available) {
      toast.error(t("audioUnavailable"));
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = stripMarkdown(translation?.content ?? translation?.summary ?? "");
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speech.voice?.lang || SPEECH_LANG[locale];
    if (speech.voice) utterance.voice = speech.voice;
    utterance.rate = 0.94;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  function generateBrief() {
    briefMutation.mutate(
      { slug: articleSlug, locale },
      {
        onSuccess: data => setBrief(data.summary),
        onError: error => toast.error(error.message),
      }
    );
  }

  return (
    <>
      <ReadingProgress />
      <article>
        <div className="container-news pt-8">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold text-muted-foreground" aria-label="Breadcrumb">
            <Link href={localePath(locale, "/")} className="hover:text-brand">{t("home")}</Link>
            <span aria-hidden="true">/</span>
            <Link href={categoryPath(locale, article.category)} className="hover:text-brand">{categoryLabel}</Link>
            {subLabel && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-brand">{subLabel}</span>
              </>
            )}
          </nav>

          {article.isDemo && (
            <div
              role="note"
              className="mb-6 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm"
            >
              <p className="font-extrabold text-foreground">{t("demoBadge")}</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">{t("demoNotice")}</p>
            </div>
          )}

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="kicker text-[0.68rem]" style={{ color: category?.accent ?? "var(--brand)" }}>
                  {categoryLabel}
                </span>
                {article.breaking && (
                  <span className="rounded-sm bg-destructive/10 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-destructive">
                    {t("breaking")}
                  </span>
                )}
                {article.featured && (
                  <span className="rounded-sm bg-brand/15 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-brand">
                    {t("featured")}
                  </span>
                )}
              </div>

              <h1 lang={translation.locale === "fa" ? "fa-AF" : translation.locale} dir={translation.locale === "en" ? "ltr" : "rtl"} className="headline text-[clamp(2.1rem,5vw,4rem)] text-foreground">{translation.title}</h1>
              {translation.summary && (
                <p lang={translation.locale === "fa" ? "fa-AF" : translation.locale} dir={translation.locale === "en" ? "ltr" : "rtl"} className="mt-5 max-w-3xl text-[1.08rem] leading-relaxed text-muted-foreground">
                  {translation.summary}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-line py-4">
                <Link href={reporterHref} className="group flex items-center gap-2.5">
                  {reporterAvatar ? (
                    <img
                      src={reporterAvatar}
                      alt={article.authorName}
                      className="h-9 w-9 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[0.68rem] font-extrabold text-paper">
                      {initials || "BMG"}
                    </span>
                  )}
                  <div>
                    <p className="text-[0.72rem] font-extrabold text-foreground group-hover:text-brand group-hover:underline">
                      {article.authorName}
                    </p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {reporterLocation ? `${t("by")} · ${reporterLocation}` : `${t("by")} · BMG`}
                    </p>
                  </div>
                </Link>
                <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {article.readMinutes} {t("minRead")}
                </span>
                <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {formatNumber(article.views)} {t("views")}
                </span>
                <span className="text-[0.7rem] font-semibold text-muted-foreground">
                  {t("published")} <bdi>{formatDate(article.publishedAt)}</bdi>
                </span>
                {speech.available && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className="ms-auto inline-flex min-h-11 items-center gap-2 rounded border border-line bg-card px-3 text-[0.68rem] font-bold text-foreground transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  aria-pressed={speaking}
                >
                  {speaking ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Headphones className="h-3.5 w-3.5" aria-hidden="true" />}
                  {speaking ? t("stop") : t("listen")}
                </button>
                )}
              </div>

              <figure className="mt-7 overflow-hidden rounded-lg border border-line bg-muted">
                <img
                  src={image}
                  alt={article.coverAlt ?? translation.title}
                  className="aspect-[16/9] w-full object-cover"
                  fetchPriority="high"
                />
                {article.coverAlt && (
                  <figcaption className="border-t border-line bg-card px-4 py-2 text-[0.68rem] text-muted-foreground">
                    {article.coverAlt}
                  </figcaption>
                )}
              </figure>

              {isFallback && locale !== "en" && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">{t("translationNotice")}</p>
                  <button
                    type="button"
                    onClick={() => setLocale("en")}
                    className="inline-flex min-h-11 items-center rounded bg-ink px-3 py-2 text-xs font-bold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {t("originalEnglish")}
                  </button>
                </div>
              )}

              <div className="my-8 rounded-lg border border-brand/30 bg-brand/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="kicker text-[0.64rem] text-teal">Buddha AI</p>
                    <h2 className="font-display mt-1 text-xl font-semibold text-foreground">{t("aiBrief")}</h2>
                  </div>
                  <Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("aiBriefIntro")}</p>
                {summary ? (
                  <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">{summary}</div>
                ) : (
                  <button
                    type="button"
                    onClick={generateBrief}
                    disabled={briefMutation.isPending}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-extrabold text-paper disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {briefMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-brand" />}
                    {briefMutation.isPending ? t("generating") : t("generateBrief")}
                  </button>
                )}
                {briefMutation.error && (
                  <p className="mt-2 text-xs font-semibold text-destructive" role="alert">
                    {briefMutation.error.message}
                  </p>
                )}
                <p className="mt-3 text-[0.66rem] leading-relaxed text-muted-foreground">{t("aiDisclaimer")}</p>
              </div>

              <div className="mt-8 max-w-3xl">
                {translation.content ? (
                  <div lang={translation.locale === "fa" ? "fa-AF" : translation.locale} dir={translation.locale === "en" ? "ltr" : "rtl"}>
                    <ArticleBody content={translation.content} />
                  </div>
                ) : (
                  <p className="text-muted-foreground">{translation.summary ?? ""}</p>
                )}
              </div>

              {article.tags.length > 0 && (
                <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5">
                  <span className="kicker text-[0.62rem] text-muted-foreground">{t("tags")}</span>
                  {article.tags.map(tag => (
                    <Link
                      key={tag}
                      href={`${localePath(locale, "/search")}?q=${encodeURIComponent(tag)}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-3 py-2 text-[0.68rem] font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <ShareButtons title={translation.title} path={articlePath(locale, article)} />
              </div>

              <div className="mt-8 rounded-lg border border-line bg-card p-5">
                <div className="flex items-start gap-4">
                  <Link href={reporterHref} className="shrink-0">
                    {reporterAvatar ? (
                      <img
                        src={reporterAvatar}
                        alt={article.authorName}
                        className="h-14 w-14 rounded-full border border-line object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-paper">
                        {initials || "BMG"}
                      </span>
                    )}
                  </Link>
                  <div className="flex-1">
                    <p className="kicker text-[0.62rem] text-brand">{t("by")}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={reporterHref}
                        className="font-display text-lg font-semibold text-foreground hover:text-brand hover:underline"
                      >
                        {article.authorName}
                      </Link>
                      {reporterLocation && (
                        <span className="text-xs font-semibold text-muted-foreground">
                          · {reporterLocation}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {reporterBio}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <Link href={reporterHref} className="link-underline font-semibold text-brand">
                        View full biography & reports →
                      </Link>
                      {" · "}
                      <Link href={pagePath(locale, "contact")} className="link-underline text-teal">{t("contactUs")}</Link>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => askBuddhaAI({ question: t("askAboutArticle"), articleSlug: article.slug })}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-teal hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("askAboutArticle")}
                </button>
              </div>

              {query.data && query.data.related.length > 0 && (
                <section className="mt-12 border-t border-line pt-8">
                  <h2 className="headline mb-6 text-3xl text-foreground">{t("related")}</h2>
                  <div className="grid gap-6 sm:grid-cols-3">
                    {query.data.related.map((related, index) => (
                      <ArticleCard key={related.id} article={related} index={index} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <div className="rounded-lg border border-line bg-card p-5">
                  <p className="kicker mb-3 text-brand">{t("about")}</p>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">{t("sections")}</dt>
                      <dd className="font-semibold text-foreground">{categoryLabel}{subLabel ? ` · ${subLabel}` : ""}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">{t("author")}</dt>
                      <dd className="font-semibold text-foreground">{article.authorName}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">{t("published")}</dt>
                      <dd className="font-semibold text-foreground">{formatDate(article.publishedAt)}</dd>
                    </div>
                    {article.updatedAt && (
                      <div>
                        <dt className="text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">{t("updated")}</dt>
                        <dd className="font-semibold text-foreground">{formatDate(article.updatedAt)}</dd>
                      </div>
                    )}
                  </dl>
                  <Link
                    href={categoryPath(locale, article.category)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-teal hover:text-brand"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" /> {t("allStories")}
                  </Link>
                </div>

                <div className="rounded-lg border border-brand/30 bg-brand/5 p-5">
                  <Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />
                  <h2 className="font-display mt-2 text-lg font-semibold text-foreground">{t("askTitle")}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("aiBriefIntro")}</p>
                  <button
                    type="button"
                    onClick={() => askBuddhaAI({ articleSlug: article.slug })}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded bg-ink px-3 py-2 text-[0.7rem] font-extrabold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {t("askAi")}
                  </button>
                </div>

                <div className="rounded-lg border border-line bg-card p-5">
                  <p className="kicker mb-3 text-brand">{t("newsletterTitle")}</p>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t("newsletterText")}</p>
                  <NewsletterForm />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </article>
    </>
  );
}
