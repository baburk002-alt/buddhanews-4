import { useState } from "react";
import { Eye, Pencil, Search, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { pickTranslation } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { AdminPageHeader, ConfirmDialog, StatusBadge } from "@/components/admin/AdminUI";
import type { ArticleDTO } from "@shared/news";

type StatusFilter = "all" | "draft" | "published" | "archived";

export default function Articles() {
  const { formatDate } = useI18n();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ArticleDTO | null>(null);

  const query = trpc.admin.articles.list.useQuery({
    status,
    search: search.trim() || undefined,
    limit: 100,
  });

  const remove = trpc.admin.articles.delete.useMutation({
    onSuccess: () => {
      toast.success("Story deleted and logged.");
      setDeleteTarget(null);
      void utils.admin.articles.list.invalidate();
      void utils.admin.stats.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div>
      <AdminPageHeader
        title="Stories"
        description="Draft, publish, correct and retire reporting. Deletions are permanent and audit-logged."
      />

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
        {query.isLoading && (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map(index => <div key={index} className="skeleton h-12 rounded" />)}
          </div>
        )}
        {query.error && <p className="p-6 text-sm text-destructive">{query.error.message}</p>}
        {!query.isLoading && !query.error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/60 text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-extrabold">Story</th>
                  <th className="px-4 py-3 font-extrabold">Section</th>
                  <th className="px-4 py-3 font-extrabold">Status</th>
                  <th className="px-4 py-3 text-right font-extrabold">Views</th>
                  <th className="px-4 py-3 font-extrabold">Updated</th>
                  <th className="px-4 py-3 text-right font-extrabold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.map(article => {
                  const title = pickTranslation(article, "en").translation?.title ?? "Untitled";
                  return (
                    <tr key={article.id} className="border-t border-line align-middle">
                      <td className="px-4 py-3">
                        <Link href={`/admin/articles/${article.id}`} className="font-semibold text-foreground hover:text-brand">
                          {title}
                        </Link>
                        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                          {article.translations.length} language{article.translations.length === 1 ? "" : "s"} · {article.authorName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{article.category}</td>
                      <td className="px-4 py-3"><StatusBadge status={article.status} /></td>
                      <td className="px-4 py-3 text-right text-xs font-bold tabular-nums">{article.views}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(article.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {article.status === "published" && (
                            <a
                              href={`/article/${article.slug}`}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted-foreground hover:border-brand hover:text-brand"
                              aria-label={`View ${title}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Link
                            href={`/admin/articles/${article.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted-foreground hover:border-brand hover:text-brand"
                            aria-label={`Edit ${title}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(article)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted-foreground hover:border-destructive hover:text-destructive"
                            aria-label={`Delete ${title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {query.data?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No stories match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Delete this story?"
        description={`“${deleteTarget ? pickTranslation(deleteTarget, "en").translation?.title : ""}” will be removed permanently, together with its translations and view records. This cannot be undone.`}
        pending={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id })}
      />
    </div>
  );
}
