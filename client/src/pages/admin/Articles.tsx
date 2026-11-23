import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { AdminPageHeader, ConfirmDialog, StatusBadge } from "@/components/admin/AdminUI";
import { getAdminToken } from "@/lib/adminAuth";

interface D1Article {
id: number;
slug: string;
category: string;
subcategory: string | null;
status: string;
author_name: string;
cover_image: string | null;
views: number;
title_en: string;
summary_en: string;
content_en: string;
title_ps: string | null;
summary_ps: string | null;
content_ps: string | null;
title_fa: string | null;
summary_fa: string | null;
content_fa: string | null;
updated_at: string;
}

type StatusFilter = "all" | "draft" | "published" | "archived";

const EMPTY_FORM = {
title_en: "",
summary_en: "",
content_en: "",
title_ps: "",
summary_ps: "",
content_ps: "",
category: "world",
status: "published",
author_name: "Buddha Newsroom",
};

export default function Articles() {
const { formatDate } = useI18n();
const [status, setStatus] = useState<StatusFilter>("all");
const [search, setSearch] = useState("");
const [articles, setArticles] = useState<D1Article[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const [deleteTarget, setDeleteTarget] = useState<D1Article | null>(null);
const [deleting, setDeleting] = useState(false);

const [editorOpen, setEditorOpen] = useState(false);
const [editingArticle, setEditingArticle] = useState<D1Article | null>(null);
const [form, setForm] = useState(EMPTY_FORM);
const [saving, setSaving] = useState(false);

const loadArticles = useCallback(async () => {
setLoading(true);
setError(null);
try {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search.trim()) params.set("search", search.trim());

  const res = await fetch(`/api/articles?${params.toString()}`);
  const data = (await res.json()) as { success?: boolean; articles?: D1Article[]; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error || "د خبرونو په راوستلو کې ستونزه راغله.");
  }
  setArticles(data.articles ?? []);
} catch (err) {
  setError(err instanceof Error ? err.message : "د خبرونو په راوستلو کې ستونزه راغله.");
} finally {
  setLoading(false);
}
}, [status, search]);

useEffect(() => {
void loadArticles();
}, [loadArticles]);

function openCreateModal() {
setEditingArticle(null);
setForm(EMPTY_FORM);
setEditorOpen(true);
}

function openEditModal(article: D1Article) {
setEditingArticle(article);
setForm({
  title_en: article.title_en || "",
  summary_en: article.summary_en || "",
  content_en: article.content_en || "",
  title_ps: article.title_ps || "",
  summary_ps: article.summary_ps || "",
  content_ps: article.content_ps || "",
  category: article.category || "world",
  status: article.status || "published",
  author_name: article.author_name || "Buddha Newsroom",
});
setEditorOpen(true);
}

async function handleSave(event: FormEvent<HTMLFormElement>) {
event.preventDefault();
const token = getAdminToken();
if (!token) {
  toast.error("مهرباني وکړئ لومړی د اډمین پاسورډ سره ننوځئ.");
  return;
}

setSaving(true);
try {
  const url = editingArticle ? `/api/articles/${editingArticle.id}` : "/api/articles";
  const method = editingArticle ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(form),
  });

  const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error || "د خبر په خوندي کولو کې ستونزه راغله.");
  }

  toast.success(data.message || "خبر خوندي شو.");
  setEditorOpen(false);
  setEditingArticle(null);
  setForm(EMPTY_FORM);
  await loadArticles();
} catch (err) {
  toast.error(err instanceof Error ? err.message : "د خبر په خوندي کولو کې ستونزه راغله.");
} finally {
  setSaving(false);
}
}

async function handleDeleteConfirm() {
if (!deleteTarget) return;
const token = getAdminToken();
if (!token) {
  toast.error("مهرباني وکړئ لومړی ننوځئ.");
  return;
}

setDeleting(true);
try {
  const res = await fetch(`/api/articles/${deleteTarget.id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error || "د خبر په لرې کولو کې ستونزه راغله.");
  }
  toast.success(data.message || "خبر لرې شو.");
  setDeleteTarget(null);
  await loadArticles();
} catch (err) {
  toast.error(err instanceof Error ? err.message : "د خبر په لرې کولو کې ستونزه راغله.");
} finally {
  setDeleting(false);
}
}

return (
<div>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <AdminPageHeader
      title="Stories (D1)"
      description="Add new stories, edit existing ones, or remove stories directly from Cloudflare D1."
    />
    <button
      type="button"
      onClick={openCreateModal}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-xs font-extrabold text-paper"
    >
      <Plus className="h-4 w-4" /> Add story
    </button>
  </div>

  <div className="mb-4 flex flex-wrap items-center gap-2">
    <div className="flex rounded-md border border-line bg-card p-1">
      {(["all", "draft", "published", "archived"] as const).map(item => (
        <button
          key={item}
          type="button"
          onClick={() => setStatus(item)}
          className={`rounded px-3 py-1.5 text-[0.68rem] font-extrabold capitalize transition-colors ${
            status === item ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
    <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
      <span className="sr-only">Search stories</span>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
      <input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="Search stories…"
        className="h-10 w-full rounded-md border border-line bg-card ps-9 pe-3 text-sm outline-none focus:border-brand"
      />
    </label>
  </div>

  <div className="overflow-hidden rounded-lg border border-line bg-card">
    {loading && (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map(index => (
          <div key={index} className="skeleton h-12 rounded" />
        ))}
      </div>
    )}
    {error && <p className="p-6 text-sm text-destructive">{error}</p>}
    {!loading && !error && (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="bg-muted/60 text-[0.62rem] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-extrabold">Story</th>
              <th className="px-4 py-3 font-extrabold">Section</th>
              <th className="px-4 py-3 font-extrabold">Status</th>
              <th className="px-4 py-3 font-extrabold">Updated</th>
              <th className="px-4 py-3 text-right font-extrabold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map(article => {
              const displayTitle = article.title_ps || article.title_en || "Untitled";
              return (
                <tr key={article.id} className="border-t border-line align-middle">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{displayTitle}</p>
                    {article.title_ps && article.title_en && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{article.title_en}</p>
                    )}
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      ID #{article.id} · {article.author_name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{article.category}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={article.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {article.updated_at ? formatDate(article.updated_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(article)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted-foreground hover:border-brand hover:text-brand"
                        aria-label={`Edit ${displayTitle}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(article)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted-foreground hover:border-destructive hover:text-destructive"
                        aria-label={`Delete ${displayTitle}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {articles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No stories found in D1 yet. Click <strong>Add story</strong> to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )}
  </div>

  {editorOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {editingArticle ? `Edit story #${editingArticle.id}` : "Add new story"}
          </h2>
          <button
            type="button"
            onClick={() => setEditorOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-foreground">
              English Title *
              <input
                required
                value={form.title_en}
                onChange={e => setForm({ ...form, title_en: e.target.value })}
                className="h-10 rounded-md border border-line bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-foreground">
              Pashto Title (پښتو سرلیک)
              <input
                dir="rtl"
                value={form.title_ps}
                onChange={e => setForm({ ...form, title_ps: e.target.value })}
                className="h-10 rounded-md border border-line bg-background px-3 text-sm font-normal"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-bold text-foreground">
              Section / Category
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="h-10 rounded-md border border-line bg-background px-3 text-sm font-normal"
              >
                <option value="afghanistan">Afghanistan</option>
                <option value="world">World</option>
                <option value="business">Business</option>
                <option value="sports">Sports</option>
                <option value="art-culture">Art & Culture</option>
                <option value="opinions">Opinions</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-foreground">
              Status
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="h-10 rounded-md border border-line bg-background px-3 text-sm font-normal"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-foreground">
              Author
              <input
                value={form.author_name}
                onChange={e => setForm({ ...form, author_name: e.target.value })}
                className="h-10 rounded-md border border-line bg-background px-3 text-sm font-normal"
              />
            </label>
          </div>

          <label className="grid gap-1 text-xs font-bold text-foreground">
            English Summary
            <input
              value={form.summary_en}
              onChange={e => setForm({ ...form, summary_en: e.target.value })}
              className="h-10 rounded-md border border-line bg-background px-3 text-sm font-normal"
            />
          </label>

          <label className="grid gap-1 text-xs font-bold text-foreground">
            English Content *
            <textarea
              required
              rows={4}
              value={form.content_en}
              onChange={e => setForm({ ...form, content_en: e.target.value })}
              className="rounded-md border border-line bg-background p-3 text-sm font-normal"
            />
          </label>

          <label className="grid gap-1 text-xs font-bold text-foreground">
            Pashto Content (پښتو متن)
            <textarea
              dir="rtl"
              rows={4}
              value={form.content_ps}
              onChange={e => setForm({ ...form, content_ps: e.target.value })}
              className="rounded-md border border-line bg-background p-3 text-sm font-normal"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="h-10 rounded-md border border-line px-4 text-xs font-bold text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-md bg-ink px-5 text-xs font-extrabold text-paper disabled:opacity-60"
            >
              {saving ? "Saving…" : editingArticle ? "Update story" : "Publish story"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  <ConfirmDialog
    open={Boolean(deleteTarget)}
    onOpenChange={open => !open && setDeleteTarget(null)}
    title="Delete this story?"
    description={`“${deleteTarget?.title_ps || deleteTarget?.title_en || ""}” will be permanently removed from D1.`}
    pending={deleting}
    onConfirm={handleDeleteConfirm}
  />
</div>
);
}
