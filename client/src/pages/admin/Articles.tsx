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
  author_avatar?: string | null;
  author_location?: string | null;
  author_bio?: string | null;
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
  author_location: "",
  author_avatar: "",
  author_bio: "",
  cover_image: "",
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
      const data = (await res.json()) as {
        success?: boolean;
        articles?: D1Article[];
        error?: string;
      };

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
    loadArticles();
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
      author_location: article.author_location || "",
      author_avatar: article.author_avatar || "",
      author_bio: article.author_bio || "",
      cover_image: article.cover_image || "",
    });
    setEditorOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) {
      toast.error("مهرباني وکړئ لومړی په ADMIN_SECRET سره ننوځئ.");
      return;
    }

    const titleEn = form.title_en.trim() || form.title_ps.trim();
    const contentEn = form.content_en.trim() || form.content_ps.trim();
    if (!titleEn || !contentEn) {
      toast.error("سرلیک او متن حتمي دي.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        title_en: titleEn,
        summary_en: form.summary_en.trim() || form.summary_ps.trim() || titleEn,
        content_en: contentEn,
        title_ps: form.title_ps.trim() || null,
        summary_ps: form.summary_ps.trim() || null,
        content_ps: form.content_ps.trim() || null,
        author_name: form.author_name.trim() || "Buddha Newsroom",
        author_location: form.author_location.trim() || null,
        author_avatar: form.author_avatar.trim() || null,
        author_bio: form.author_bio.trim() || null,
        cover_image: form.cover_image.trim() || "/og-fallback.svg",
      };

      const isEdit = Boolean(editingArticle);
      const url = isEdit ? `/api/articles/${editingArticle!.id}` : "/api/articles";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "د خبر په خوندي کولو کې ستونزه راغله.");
      }

      toast.success(data.message || (isEdit ? "خبر تازه شو." : "نوی خبر اضافه شو."));
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

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const token = getAdminToken();
    if (!token) {
      toast.error("مهرباني وکړئ لومړی په ADMIN_SECRET سره ننوځئ.");
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
      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Stories (D1)"
        description="Add new stories, edit existing ones, or remove stories directly from Cloudflare D1."
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-extrabold text-paper hover:bg-brand hover:text-ink"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add story
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "draft", "published", "archived"] as StatusFilter[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatus(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                status === tab
                  ? "bg-ink text-paper"
                  : "border border-line bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stories..."
            className="h-10 w-full rounded-md border border-line bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-muted/40 text-[0.68rem] font-extrabold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Story</th>
              <th className="px-4 py-3">Reporter & Area</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading stories from D1...
                </td>
              </tr>
            ) : articles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No stories found in D1 yet. Click Add story to create one.
                </td>
              </tr>
            ) : (
              articles.map(article => (
                <tr key={article.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div>{article.title_en || article.title_ps || "Untitled"}</div>
                    {article.title_ps && (
                      <div dir="rtl" className="mt-0.5 text-[0.72rem] text-muted-foreground">
                        {article.title_ps}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="font-semibold text-foreground">{article.author_name}</div>
                    {article.author_location && (
                      <div className="text-[0.68rem] text-muted-foreground">{article.author_location}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{article.category}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={article.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(article.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(article)}
                        aria-label="Edit story"
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-line bg-background text-foreground hover:border-brand hover:text-brand"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(article)}
                        aria-label="Delete story"
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-line bg-background text-destructive hover:border-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="font-display text-lg font-bold text-foreground">
                {editingArticle ? "Edit Story (D1)" : "Add New Story (D1)"}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-foreground">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                  >
                    <option value="afghanistan">Afghanistan</option>
                    <option value="world">World</option>
                    <option value="business">Business</option>
                    <option value="sports">Sports</option>
                    <option value="art-culture">Art & Culture</option>
                    <option value="opinions">Opinions</option>
                    <option value="special-events">Special Events</option>
                    <option value="videos">Videos</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-foreground">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                  >
                    <option value="published">published</option>
                    <option value="draft">draft</option>
                    <option value="archived">archived</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-foreground">Reporter Name</label>
                  <input
                    type="text"
                    value={form.author_name}
                    onChange={e => setForm({ ...form, author_name: e.target.value })}
                    className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-foreground">Reporter Area / Location</label>
                  <input
                    type="text"
                    value={form.author_location}
                    onChange={e => setForm({ ...form, author_location: e.target.value })}
                    placeholder="e.g. Kabul, Kandahar, Herat"
                    className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-foreground">Reporter Short Photo URL</label>
                  <input
                    type="text"
                    value={form.author_avatar}
                    onChange={e => setForm({ ...form, author_avatar: e.target.value })}
                    placeholder="https://... or /..."
                    className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-foreground">Report / Area Cover Image URL</label>
                  <input
                    type="text"
                    value={form.cover_image}
                    onChange={e => setForm({ ...form, cover_image: e.target.value })}
                    placeholder="https://... or /og-fallback.svg"
                    className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-foreground">Reporter Biography</label>
                  <input
                    type="text"
                    value={form.author_bio}
                    onChange={e => setForm({ ...form, author_bio: e.target.value })}
                    placeholder="Who is this reporter and what do they cover?"
                    className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Title (English)</label>
                <input
                  type="text"
                  value={form.title_en}
                  onChange={e => setForm({ ...form, title_en: e.target.value })}
                  placeholder="Headline in English..."
                  className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Summary (English)</label>
                <textarea
                  rows={2}
                  value={form.summary_en}
                  onChange={e => setForm({ ...form, summary_en: e.target.value })}
                  placeholder="Short summary..."
                  className="w-full rounded-md border border-line bg-background p-3 text-foreground"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Content (English)</label>
                <textarea
                  rows={5}
                  value={form.content_en}
                  onChange={e => setForm({ ...form, content_en: e.target.value })}
                  placeholder="Full report body (you can also include ![caption](image-url))..."
                  className="w-full rounded-md border border-line bg-background p-3 text-foreground"
                />
              </div>

              <div className="border-t border-line pt-3">
                <label className="mb-1 block font-bold text-foreground">سرلیک (پښتو - اختیاري)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={form.title_ps}
                  onChange={e => setForm({ ...form, title_ps: e.target.value })}
                  placeholder="پښتو سرلیک..."
                  className="h-10 w-full rounded-md border border-line bg-background px-3 text-foreground"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">متن (پښتو - اختیاري)</label>
                <textarea
                  rows={4}
                  dir="rtl"
                  value={form.content_ps}
                  onChange={e => setForm({ ...form, content_ps: e.target.value })}
                  placeholder="د راپور پښتو متن..."
                  className="w-full rounded-md border border-line bg-background p-3 text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-md border border-line bg-background px-4 py-2 font-bold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-ink px-4 py-2 font-extrabold text-paper hover:bg-brand hover:text-ink disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingArticle ? "Save Changes" : "Publish Story"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete story from D1?"
        description={
          deleteTarget
            ? `Are you sure you want to permanently delete "${deleteTarget.title_en || deleteTarget.title_ps || "this story"}"?`
            : ""
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
