import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bold,
  Eye,
  Heading2,
  History,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  Loader2,
  Quote,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { CATEGORIES, LOCALES, getCategory, type Locale } from "@shared/news";
import { useAuth } from "@/_core/hooks/useAuth";
import { draftKey as buildDraftKey, readDraft, removeDraft, writeDraft } from "@/lib/drafts";
import { trpc } from "@/lib/trpc";
import { AdminPageHeader, ConfirmDialog, StatusBadge } from "@/components/admin/AdminUI";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ArticleBody } from "@/components/site/ArticleBody";

type TranslationForm = {
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
};

type FormState = {
  slug: string;
  status: "draft" | "published" | "archived";
  category: string;
  subcategory: string;
  coverImage: string;
  coverAlt: string;
  authorName: string;
  featured: boolean;
  breaking: boolean;
  readMinutes: number;
  tags: string;
  translations: Record<Locale, TranslationForm>;
};

function emptyTranslation(locale: Locale): TranslationForm {
  return { locale, slug: "", title: "", summary: "", content: "", seoTitle: "", seoDescription: "" };
}

function emptyForm(authorName: string): FormState {
  return {
    slug: "",
    status: "draft",
    category: "afghanistan",
    subcategory: "",
    coverImage: "",
    coverAlt: "",
    authorName,
    featured: false,
    breaking: false,
    readMinutes: 3,
    tags: "",
    translations: {
      en: emptyTranslation("en"),
      ps: emptyTranslation("ps"),
      fa: emptyTranslation("fa"),
    },
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

const AI_LABELS: Record<string, string> = {
  headline: "Headline options",
  summary: "Draft summary",
  seo: "SEO metadata",
  tags: "Suggested tags",
  translate: "Translation draft",
};

export default function ArticleEditor() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id;
  const articleId = Number(params.id);
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<FormState>(() => emptyForm(user?.name ?? "BMG Desk"));
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [preview, setPreview] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aiResult, setAiResult] = useState<{ task: string; text: string; targetLocale?: Locale } | null>(null);
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const loadedIdRef = useRef<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<{ form: FormState; savedAt: string } | null>(null);
  const draftKey = buildDraftKey(user?.id ?? "anonymous", isNew ? "new" : articleId);

  const articleQuery = trpc.admin.articles.get.useQuery(
    { id: articleId },
    { enabled: !isNew && Number.isInteger(articleId) && articleId > 0, retry: false }
  );

  useEffect(() => {
    const article = articleQuery.data;
    if (!article || loadedIdRef.current === article.id) return;
    loadedIdRef.current = article.id;
    const translations = { ...emptyForm(article.authorName).translations };
    for (const locale of LOCALES) {
      const existing = article.translations.find(item => item.locale === locale.code);
      if (existing) {
        translations[locale.code] = {
          locale: locale.code,
          slug: existing.slug ?? "",
          title: existing.title,
          summary: existing.summary ?? "",
          content: existing.content ?? "",
          seoTitle: existing.seoTitle ?? "",
          seoDescription: existing.seoDescription ?? "",
        };
      }
    }
    setForm({
      slug: article.slug,
      status: article.status,
      category: article.category,
      subcategory: article.subcategory ?? "",
      coverImage: article.coverImage ?? "",
      coverAlt: article.coverAlt ?? "",
      authorName: article.authorName,
      featured: article.featured,
      breaking: article.breaking,
      readMinutes: article.readMinutes,
      tags: article.tags.join(", "),
      translations,
    });
  }, [articleQuery.data]);

  // A browser crash or an accidental tab close should not cost a story. The
  // draft is written to this device only (never to the server) three seconds
  // after typing stops, and offered back on the next visit.
  useEffect(() => {
    if (!isNew || !user) return;
    const stored = readDraft<FormState>(draftKey);
    if (stored?.form?.translations?.en) {
      setSavedDraft({ form: stored.form, savedAt: stored.savedAt });
    }
  }, [draftKey, isNew, user]);

  useEffect(() => {
    if (!dirty || !user) return;
    const timer = window.setTimeout(() => {
      // Quota or private-mode failures must never interrupt writing.
      const savedAt = writeDraft(draftKey, form);
      if (savedAt) setAutosavedAt(new Date(savedAt).toLocaleTimeString());
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [dirty, draftKey, form, user]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const mediaQuery = trpc.admin.media.list.useQuery(undefined, { enabled: libraryOpen });
  const clearLocalDraft = () => {
    removeDraft(draftKey);
    setDirty(false);
    setSavedDraft(null);
  };

  const createArticle = trpc.admin.articles.create.useMutation({
    onSuccess: () => {
      clearLocalDraft();
      toast.success("Story created and logged.");
      void utils.admin.articles.list.invalidate();
      void utils.admin.stats.invalidate();
      navigate("/admin/articles");
    },
    onError: error => toast.error(error.message),
  });
  const updateArticle = trpc.admin.articles.update.useMutation({
    onSuccess: () => {
      clearLocalDraft();
      toast.success("Story saved and logged.");
      void utils.admin.articles.list.invalidate();
      void utils.admin.stats.invalidate();
      void utils.admin.articles.get.invalidate({ id: articleId });
    },
    onError: error => toast.error(error.message),
  });
  const deleteArticle = trpc.admin.articles.delete.useMutation({
    onSuccess: () => {
      toast.success("Story deleted and logged.");
      void utils.admin.articles.list.invalidate();
      navigate("/admin/articles");
    },
    onError: error => toast.error(error.message),
  });
  const uploadImage = trpc.admin.media.upload.useMutation({
    onSuccess: data => {
      updateField("coverImage", data.url);
      toast.success("Cover uploaded and logged.");
      void utils.admin.media.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const ai = trpc.admin.ai.generate.useMutation();
  const revisionsQuery = trpc.admin.articles.revisions.useQuery(
    { id: articleId, limit: 20 },
    { enabled: !isNew && Number.isInteger(articleId) && articleId > 0 }
  );
  const restoreRevision = trpc.admin.articles.restoreRevision.useMutation({
    onSuccess: () => {
      toast.success("Revision restored as a draft. Review it before publishing.");
      void utils.admin.articles.get.invalidate({ id: articleId });
      void revisionsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const translation = form.translations[activeLocale];
  const category = getCategory(form.category);
  const pending = createArticle.isPending || updateArticle.isPending;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setDirty(true);
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function updateTranslation(patch: Partial<TranslationForm>) {
    setDirty(true);
    setForm(previous => ({
      ...previous,
      translations: {
        ...previous.translations,
        [activeLocale]: { ...previous.translations[activeLocale], ...patch },
      },
    }));
  }

  function insertMarkdown(before: string, after = "", fallback = "") {
    const element = contentRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = translation.content.slice(start, end) || fallback;
    const next = `${translation.content.slice(0, start)}${before}${selected}${after}${translation.content.slice(end)}`;
    updateTranslation({ content: next });
    window.requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function onCoverFile(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Images must be smaller than 5 MB.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1] ?? "";
      uploadImage.mutate(
        {
          filename: file.name,
          mime: file.type as "image/jpeg" | "image/png" | "image/webp",
          dataBase64: base64,
          alt: form.coverAlt || file.name,
        },
        { onSettled: () => setUploading(false) }
      );
    };
    reader.onerror = () => {
      setUploading(false);
      toast.error("Could not read that file.");
    };
    reader.readAsDataURL(file);
  }

  function runAi(task: "headline" | "summary" | "seo" | "tags" | "translate", targetLocale?: Locale) {
    const source = `${translation.title}\n\n${translation.summary}\n\n${translation.content}`.trim();
    if (!source) {
      toast.error("Add a title or some text before using AI.");
      return;
    }
    setAiResult(null);
    ai.mutate(
      { task, locale: activeLocale, targetLocale, source },
      {
        onSuccess: data => setAiResult({ task, text: data.text, targetLocale }),
        onError: error => toast.error(error.message),
      }
    );
  }

  function applyAi() {
    if (!aiResult) return;
    if (aiResult.task === "translate") {
      const target = aiResult.targetLocale;
      if (!target) return;
      const title = aiResult.text.match(/###TITLE###\s*([\s\S]*?)\s*###SUMMARY###/)?.[1]?.trim() ?? "";
      const summary = aiResult.text.match(/###SUMMARY###\s*([\s\S]*?)\s*###CONTENT###/)?.[1]?.trim() ?? "";
      const content = aiResult.text.match(/###CONTENT###\s*([\s\S]*)$/)?.[1]?.trim() ?? "";
      setForm(previous => ({
        ...previous,
        translations: {
          ...previous.translations,
          [target]: {
            ...previous.translations[target],
            title: title || previous.translations[target].title,
            summary: summary || previous.translations[target].summary,
            content: content || previous.translations[target].content,
          },
        },
      }));
      setActiveLocale(target);
      toast.success("Translation applied. Review it before publishing.");
    } else if (aiResult.task === "summary") {
      updateTranslation({ summary: aiResult.text });
      toast.success("Summary applied.");
    } else if (aiResult.task === "seo") {
      const seoTitle = aiResult.text.match(/TITLE:\s*(.+)/i)?.[1]?.trim() ?? "";
      const seoDescription = aiResult.text.match(/DESCRIPTION:\s*(.+)/i)?.[1]?.trim() ?? "";
      updateTranslation({ seoTitle, seoDescription });
      toast.success("SEO fields applied.");
    } else if (aiResult.task === "tags") {
      const tags = aiResult.text.replace(/^tags?:\s*/i, "").split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12).join(", ");
      updateField("tags", tags);
      toast.success("Tags applied.");
    }
    setAiResult(null);
  }

  function applyHeadline(headline: string) {
    updateTranslation({ title: headline });
    setAiResult(null);
  }

  function save() {
    const english = form.translations.en;
    if (english.title.trim().length < 3) {
      setActiveLocale("en");
      toast.error("An English title is required.");
      return;
    }
    const translations = LOCALES.map(locale => form.translations[locale.code])
      .filter(item => item.title.trim().length >= 3)
      .map(item => ({
        locale: item.locale,
        slug: item.slug.trim() || null,
        title: item.title.trim(),
        summary: item.summary.trim() || null,
        content: item.content.trim() || null,
        seoTitle: item.seoTitle.trim() || null,
        seoDescription: item.seoDescription.trim() || null,
      }));
    const payload = {
      slug: slugify(form.slug || english.title) || `story-${Date.now()}`,
      status: form.status,
      category: form.category,
      subcategory: form.subcategory || null,
      coverImage: form.coverImage.trim() || null,
      coverAlt: form.coverAlt.trim() || null,
      authorName: form.authorName.trim() || "BMG Desk",
      featured: form.featured,
      breaking: form.breaking,
      readMinutes: Math.max(1, Math.min(60, Number(form.readMinutes) || 1)),
      tags: form.tags.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12),
      translations,
    };
    if (isNew) createArticle.mutate(payload);
    else updateArticle.mutate({ ...payload, id: articleId });
  }

  if (!isNew && articleQuery.isLoading) {
    return <div className="space-y-3"><div className="skeleton h-10 w-64 rounded" /><div className="skeleton h-[520px] rounded-lg" /></div>;
  }
  if (!isNew && articleQuery.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <p className="text-sm font-bold">Story could not be loaded</p>
        <p className="mt-1 text-sm text-muted-foreground">{articleQuery.error.message}</p>
        <Link href="/admin/articles" className="mt-4 inline-flex text-sm font-bold text-teal">Back to stories →</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/articles"
          onClick={event => {
            if (dirty && !window.confirm("You have unsaved changes. Leave this page?")) {
              event.preventDefault();
            }
          }}
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-brand"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All stories
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={form.status} />
          {dirty && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {autosavedAt ? `Draft saved ${autosavedAt}` : "Unsaved changes"}
            </span>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-bold text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-xs font-extrabold text-paper disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? "Saving…" : dirty ? "Save changes" : "Save story"}
          </button>
        </div>
      </div>

      {savedDraft && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs">
          <p className="font-semibold text-foreground">
            An unsaved draft from this device
            {savedDraft.savedAt ? ` (${new Date(savedDraft.savedAt).toLocaleString()})` : ""} is available.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(savedDraft.form);
                setDirty(true);
                setSavedDraft(null);
              }}
              className="rounded bg-ink px-3 py-1.5 text-[0.66rem] font-extrabold text-paper"
            >
              Restore draft
            </button>
            <button
              type="button"
              onClick={() => {
                removeDraft(draftKey);
                setSavedDraft(null);
              }}
              className="rounded border border-line px-3 py-1.5 text-[0.66rem] font-bold text-muted-foreground"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <AdminPageHeader
        title={isNew ? "New story" : "Edit story"}
        description="Write in English, then translate or draft with AI. A human editor remains responsible for every published line."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-line bg-card">
            <div className="flex flex-wrap items-center gap-1 border-b border-line p-2">
              {LOCALES.map(locale => {
                const item = form.translations[locale.code];
                const complete = item.title.trim().length >= 3;
                return (
                  <button
                    key={locale.code}
                    type="button"
                    onClick={() => setActiveLocale(locale.code)}
                    className={`inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-extrabold transition-colors ${
                      activeLocale === locale.code ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {locale.english}
                    <span className={`h-1.5 w-1.5 rounded-full ${complete ? "bg-teal" : "bg-line"}`} aria-hidden="true" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPreview(value => !value)}
                className={`ms-auto inline-flex items-center gap-1.5 rounded px-2.5 py-2 text-[0.68rem] font-bold ${
                  preview ? "bg-brand/15 text-brand" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
            </div>

            <div className="space-y-4 p-4" dir={activeLocale === "en" ? "ltr" : "rtl"}>
              <label className="grid gap-1.5 text-xs font-extrabold text-foreground">
                Title <span className="text-destructive">*</span>
                <input
                  value={translation.title}
                  onChange={event => updateTranslation({ title: event.target.value })}
                  maxLength={300}
                  className="h-12 rounded-md border border-line bg-background px-3 text-lg font-semibold outline-none focus:border-brand"
                  placeholder={activeLocale === "en" ? "A clear, specific headline" : "Translated headline"}
                  dir={activeLocale === "en" ? "ltr" : "rtl"}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-extrabold text-foreground">
                Summary
                <textarea
                  value={translation.summary}
                  onChange={event => updateTranslation({ summary: event.target.value })}
                  rows={3}
                  maxLength={1200}
                  className="rounded-md border border-line bg-background px-3 py-2 text-sm font-normal leading-relaxed outline-none focus:border-brand"
                  placeholder="Two sentences that tell the reader what changed."
                />
              </label>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-foreground">Body <span className="font-normal text-muted-foreground">(Markdown)</span></p>
                  <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Markdown formatting">
                    {[
                      { label: "H2", icon: Heading2, action: () => insertMarkdown("## ", "", "Section heading") },
                      { label: "Bold", icon: Bold, action: () => insertMarkdown("**", "**", "bold text") },
                      { label: "Italic", icon: Italic, action: () => insertMarkdown("*", "*", "italic text") },
                      { label: "Quote", icon: Quote, action: () => insertMarkdown("> ", "", "A quotation") },
                      { label: "List", icon: List, action: () => insertMarkdown("- ", "", "List item") },
                      { label: "Link", icon: LinkIcon, action: () => insertMarkdown("[", "](https://example.com)", "link text") },
                    ].map(tool => (
                      <button
                        key={tool.label}
                        type="button"
                        onClick={tool.action}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-line text-muted-foreground hover:border-brand hover:text-brand"
                        aria-label={tool.label}
                        title={tool.label}
                      >
                        <tool.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                {preview ? (
                  <div className="min-h-[360px] rounded-md border border-line bg-background p-5" dir={activeLocale === "en" ? "ltr" : "rtl"}>
                    {translation.content ? <ArticleBody content={translation.content} /> : <p className="text-muted-foreground">Nothing to preview yet.</p>}
                  </div>
                ) : (
                  <textarea
                    ref={contentRef}
                    value={translation.content}
                    onChange={event => updateTranslation({ content: event.target.value })}
                    rows={18}
                    className="w-full rounded-md border border-line bg-background px-3 py-3 font-mono text-[0.82rem] leading-relaxed outline-none focus:border-brand"
                    placeholder="Write the story. Use ## for section headings, > for quotes, and blank lines between paragraphs."
                    dir={activeLocale === "en" ? "ltr" : "rtl"}
                  />
                )}
                <p className="mt-1 text-[0.65rem] text-muted-foreground">{translation.content.length.toLocaleString()} characters</p>
              </div>

              <details className="rounded-md border border-line bg-background p-3">
                <summary className="cursor-pointer text-xs font-extrabold text-foreground">Search engine metadata</summary>
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                    SEO title
                    <input
                      value={translation.seoTitle}
                      onChange={event => updateTranslation({ seoTitle: event.target.value })}
                      maxLength={200}
                      className="h-10 rounded border border-line bg-card px-3 text-sm font-normal outline-none focus:border-brand"
                    />
                  </label>
                  <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                    Meta description
                    <textarea
                      value={translation.seoDescription}
                      onChange={event => updateTranslation({ seoDescription: event.target.value })}
                      rows={2}
                      maxLength={320}
                      className="rounded border border-line bg-card px-3 py-2 text-sm font-normal outline-none focus:border-brand"
                    />
                  </label>
                </div>
              </details>
            </div>
          </section>

          <section className="rounded-lg border border-brand/30 bg-brand/5 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-extrabold text-foreground">AI drafting tools</h2>
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-wide text-brand">Editor review required</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              The model works from the {LOCALES.find(locale => locale.code === activeLocale)?.english} text above. It will not invent facts; you still verify every line.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["headline", "summary", "seo", "tags"] as const).map(task => (
                <button
                  key={task}
                  type="button"
                  onClick={() => runAi(task)}
                  disabled={ai.isPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-card px-3 text-[0.68rem] font-bold text-foreground hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  {ai.isPending && ai.variables?.task === task ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-brand" />}
                  {task === "headline" ? "Headlines" : task === "summary" ? "Summary" : task === "seo" ? "SEO" : "Tags"}
                </button>
              ))}
              {LOCALES.filter(locale => locale.code !== activeLocale).map(locale => (
                <button
                  key={locale.code}
                  type="button"
                  onClick={() => runAi("translate", locale.code)}
                  disabled={ai.isPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-card px-3 text-[0.68rem] font-bold text-foreground hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  {ai.isPending && ai.variables?.task === "translate" && ai.variables?.targetLocale === locale.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-brand" />}
                  Translate to {locale.label}
                </button>
              ))}
            </div>
            {ai.error && <p className="mt-2 text-xs font-semibold text-destructive" role="alert">{ai.error.message}</p>}
            {aiResult && (
              <div className="mt-3 rounded-md border border-line bg-card p-3">
                <p className="kicker text-[0.6rem] text-brand">{AI_LABELS[aiResult.task]}</p>
                {aiResult.task === "headline" ? (
                  <div className="mt-2 grid gap-1">
                    {aiResult.text.split("\n").map(line => line.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean).map((headline, index) => (
                      <button
                        key={`${headline}-${index}`}
                        type="button"
                        onClick={() => applyHeadline(headline)}
                        className="rounded border border-line px-2.5 py-2 text-start text-xs font-semibold text-foreground hover:border-brand hover:text-brand"
                      >
                        {headline}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">{aiResult.text}</pre>
                    <button type="button" onClick={applyAi} className="mt-2 rounded bg-ink px-3 py-1.5 text-[0.66rem] font-extrabold text-paper">
                      Apply to {aiResult.task === "translate" ? LOCALES.find(locale => locale.code === aiResult.targetLocale)?.english : "this language"}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-line bg-card p-4">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Publishing</h2>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                Status
                <select
                  value={form.status}
                  onChange={event => updateField("status", event.target.value as FormState["status"])}
                  className="h-10 rounded border border-line bg-background px-2 text-sm font-normal"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                Section
                <select
                  value={form.category}
                  onChange={event => {
                    updateField("category", event.target.value);
                    updateField("subcategory", "");
                  }}
                  className="h-10 rounded border border-line bg-background px-2 text-sm font-normal"
                >
                  {CATEGORIES.map(item => <option key={item.key} value={item.key}>{item.label.en}</option>)}
                </select>
              </label>
              {category && category.subcategories.length > 0 && (
                <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                  Subsection
                  <select
                    value={form.subcategory}
                    onChange={event => updateField("subcategory", event.target.value)}
                    className="h-10 rounded border border-line bg-background px-2 text-sm font-normal"
                  >
                    <option value="">None</option>
                    {category.subcategories.map(sub => <option key={sub.key} value={sub.key}>{sub.label.en}</option>)}
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                Author
                <input
                  value={form.authorName}
                  onChange={event => updateField("authorName", event.target.value)}
                  maxLength={160}
                  className="h-10 rounded border border-line bg-background px-2 text-sm font-normal outline-none focus:border-brand"
                />
              </label>
              <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                Read minutes
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.readMinutes}
                  onChange={event => updateField("readMinutes", Number(event.target.value))}
                  className="h-10 rounded border border-line bg-background px-2 text-sm font-normal outline-none focus:border-brand"
                />
              </label>
              <label className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                Tags <span className="font-normal text-muted-foreground">(comma separated)</span>
                <input
                  value={form.tags}
                  onChange={event => updateField("tags", event.target.value)}
                  className="h-10 rounded border border-line bg-background px-2 text-sm font-normal outline-none focus:border-brand"
                />
              </label>
              <div className="grid gap-2 rounded-md bg-muted/60 p-3">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <input type="checkbox" checked={form.featured} onChange={event => updateField("featured", event.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                  Feature on the front page
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <input type="checkbox" checked={form.breaking} onChange={event => updateField("breaking", event.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                  Breaking news ticker
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-card p-4">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Cover image</h2>
            <div className="aspect-[16/10] overflow-hidden rounded-md border border-line bg-muted">
              {form.coverImage ? (
                <img src={form.coverImage} alt={form.coverAlt || "Cover preview"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground"><ImagePlus className="h-7 w-7" /></div>
              )}
            </div>
            <label className="mt-3 grid gap-1 text-[0.68rem] font-bold text-foreground">
              Image URL
              <input
                value={form.coverImage}
                onChange={event => updateField("coverImage", event.target.value)}
                className="h-9 rounded border border-line bg-background px-2 text-xs font-normal outline-none focus:border-brand"
                placeholder="/manus-storage/…"
              />
            </label>
            <label className="mt-2 grid gap-1 text-[0.68rem] font-bold text-foreground">
              Alt text
              <input
                value={form.coverAlt}
                onChange={event => updateField("coverAlt", event.target.value)}
                maxLength={400}
                className="h-9 rounded border border-line bg-background px-2 text-xs font-normal outline-none focus:border-brand"
                placeholder="Describe the image for screen readers"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-line px-2.5 text-[0.66rem] font-bold hover:border-brand">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {uploading ? "Uploading…" : "Upload"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => onCoverFile(event.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setLibraryOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded border border-line px-2.5 text-[0.66rem] font-bold hover:border-brand">
                <ImagePlus className="h-3 w-3" /> Library
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-card p-4">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">URLs</h2>
            <p className="mb-3 text-[0.64rem] leading-relaxed text-muted-foreground">
              Each language can have its own readable address. Leave a field empty to derive it from the
              headline. Changing a published address creates an automatic redirect from the old one.
            </p>
            <div className="grid gap-3">
              {LOCALES.map(locale => (
                <label key={locale.code} className="grid gap-1 text-[0.68rem] font-bold text-foreground">
                  {locale.english} slug
                  <div className="flex gap-2">
                    <input
                      value={form.translations[locale.code].slug}
                      onChange={event => {
                        setDirty(true);
                        setForm(previous => ({
                          ...previous,
                          translations: {
                            ...previous.translations,
                            [locale.code]: {
                              ...previous.translations[locale.code],
                              slug: event.target.value,
                            },
                          },
                        }));
                      }}
                      dir={locale.code === "en" ? "ltr" : "rtl"}
                      className="h-9 min-w-0 flex-1 rounded border border-line bg-background px-2 text-xs font-normal outline-none focus:border-brand"
                      placeholder="auto-from-title"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm(previous => ({
                          ...previous,
                          translations: {
                            ...previous.translations,
                            [locale.code]: {
                              ...previous.translations[locale.code],
                              slug: slugify(previous.translations[locale.code].title),
                            },
                          },
                        }))
                      }
                      className="h-9 shrink-0 rounded border border-line px-2 text-[0.62rem] font-bold hover:border-brand"
                    >
                      From title
                    </button>
                  </div>
                  <span className="break-all font-normal text-[0.62rem] text-muted-foreground">
                    /{locale.code}/article/{form.translations[locale.code].slug || slugify(form.translations[locale.code].title) || "…"}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {!isNew && (
            <section className="rounded-lg border border-line bg-card p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Revision history
              </h2>
              {revisionsQuery.isLoading && <p className="text-[0.68rem] text-muted-foreground">Loading revisions…</p>}
              {revisionsQuery.error && (
                <p className="text-[0.68rem] text-destructive">{revisionsQuery.error.message}</p>
              )}
              <ol className="space-y-2">
                {revisionsQuery.data?.map(revision => (
                  <li key={revision.id} className="rounded border border-line bg-background px-3 py-2">
                    <p className="text-[0.66rem] font-extrabold text-foreground">
                      {revision.action} · {revision.editorName ?? "Unknown editor"}
                    </p>
                    <p className="text-[0.62rem] text-muted-foreground">
                      {new Date(revision.createdAt).toLocaleString()}
                    </p>
                    {revision.summary && (
                      <p className="mt-1 text-[0.62rem] leading-relaxed text-muted-foreground">{revision.summary}</p>
                    )}
                    {isAdmin && revision.action !== "delete" && (
                      <button
                        type="button"
                        disabled={restoreRevision.isPending}
                        onClick={() => {
                          if (window.confirm("Restore this revision as a draft? The current text will be replaced.")) {
                            restoreRevision.mutate({ id: revision.id });
                          }
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[0.6rem] font-bold text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" /> Restore as draft
                      </button>
                    )}
                  </li>
                ))}
                {revisionsQuery.data?.length === 0 && (
                  <li className="text-[0.66rem] text-muted-foreground">No revisions recorded yet.</li>
                )}
              </ol>
            </section>
          )}
        </aside>
      </div>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>Choose an uploaded image for this story.</DialogDescription>
          {mediaQuery.isLoading && <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(index => <div key={index} className="skeleton aspect-video rounded" />)}</div>}
          {mediaQuery.data && mediaQuery.data.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No uploads yet. Use the Upload button in the cover panel.</p>
          )}
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {mediaQuery.data?.map(asset => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  updateField("coverImage", asset.url);
                  if (asset.alt) updateField("coverAlt", asset.alt);
                  setLibraryOpen(false);
                }}
                className="overflow-hidden rounded-md border border-line text-start hover:border-brand"
              >
                <img src={asset.url} alt={asset.alt ?? asset.filename} className="aspect-video w-full object-cover" loading="lazy" />
                <span className="block truncate px-2 py-1.5 text-[0.62rem] font-semibold text-muted-foreground">{asset.filename}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this story?"
        description="This removes the story, all three language versions and its view records. The action cannot be undone."
        pending={deleteArticle.isPending}
        onConfirm={() => deleteArticle.mutate({ id: articleId })}
      />
    </div>
  );
}
