import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { articlePath, articleTitle } from "@/lib/news";
import { trpc } from "@/lib/trpc";

export function Ticker() {
  const { t, locale } = useI18n();
  const { data } = trpc.articles.list.useQuery({ limit: 10 }, { staleTime: 60_000 });
  if (!data || data.length === 0) return null;

  const breaking = data.filter(article => article.breaking);
  const items = (breaking.length > 0 ? breaking : data.slice(0, 5)).slice(0, 6);

  return (
    <div
      className="marquee relative overflow-hidden border-b border-[#2a333d] bg-[#151a20] text-[#f6f1e8]"
      aria-label={t("breaking")}
    >
      <div className="container-news flex items-center gap-0">
        <span className="z-10 flex shrink-0 items-center gap-2 bg-brand px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-brand-foreground">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-brand-foreground" aria-hidden="true" />
          {t("breaking")}
        </span>
        <div className="min-w-0 flex-1 overflow-x-auto py-2" tabIndex={0} role="region" aria-label={t("breaking")}>
          <div className="flex w-max gap-8 px-3">
            {items.map(article => (
              <Link
                key={article.id}
                href={articlePath(locale, article)}
                className="flex shrink-0 items-center gap-3 whitespace-nowrap text-[0.78rem] font-semibold text-[#fffdf8] transition-colors hover:text-[#f0b24f]"
              >
                <span className="h-1 w-1 rounded-full bg-brand/80" aria-hidden="true" />
                {articleTitle(article, locale)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
