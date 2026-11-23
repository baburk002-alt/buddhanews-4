import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Search, ArrowUpRight, X } from "lucide-react";
import { useLocation } from "wouter";
import { localePath } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { articlePath, articleTitle, categoryName, coverImage } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  const showResults = debounced.length >= 2 && debounced === query.trim();
  const { data, isFetching } = trpc.articles.list.useQuery(
    { search: debounced, limit: 8 },
    { enabled: open && showResults, staleTime: 30_000 }
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    onOpenChange(false);
    navigate(`${localePath(locale, "/search")}?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onOpenAutoFocus={event => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const previous = returnFocusRef.current;
          const fallback = document.querySelector<HTMLButtonElement>("[data-site-search-trigger]");
          if (previous?.isConnected && previous !== document.body && !previous.closest('[data-state="closed"]')) {
            previous.focus();
          } else {
            fallback?.focus();
          }
        }}
      >
        <DialogTitle className="sr-only">{t("searchTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("searchHint")}</DialogDescription>
        <form onSubmit={onSubmit} className="flex items-center gap-3 border-b border-line px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            dir="auto"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-11 min-w-0 flex-1 rounded bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
          />
          {showResults && isFetching && (
            <span role="status" className="shrink-0">
              <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
              <span className="sr-only">{t("loading")}</span>
            </span>
          )}
          <kbd className="hidden rounded border border-line bg-muted px-2 py-1 text-[0.65rem] font-bold text-muted-foreground sm:inline">
            Enter
          </kbd>
          <DialogClose
            type="button"
            aria-label={t("close")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogClose>
        </form>

        <div className="max-h-[60vh] overflow-y-auto p-2" aria-busy={showResults && isFetching}>
          {query.trim().length < 2 && (
            <p className="px-3 py-6 text-sm text-muted-foreground">{t("searchHint")}</p>
          )}
          {showResults && !isFetching && data && data.length === 0 && (
            <div className="px-3 py-6" role="status">
              <p className="text-sm font-semibold text-foreground">{t("noResults")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("searchNoResultsHint")}</p>
            </div>
          )}
          <ul className="grid gap-1">
            {showResults && data?.map(article => (
              <li key={article.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(articlePath(locale, article));
                  }}
                  className="group flex w-full items-center gap-3 rounded-md p-2 text-start transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <img
                    src={coverImage(article)}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="kicker block text-[0.6rem] text-brand">
                      {categoryName(article.category, locale)}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                      {articleTitle(article, locale)}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand rtl:-scale-x-100" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
