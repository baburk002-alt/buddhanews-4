import { AlertTriangle, Loader2, SearchX } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="container-news flex min-h-[52vh] flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm font-semibold">{label ?? t("loading")}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry, headingLevel = 1 }: { message?: string; onRetry?: () => void; headingLevel?: 1 | 2 }) {
  const { t } = useI18n();
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return (
    <div role="alert" className="container-news flex min-h-[52vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-brand" aria-hidden="true" />
      <div>
        <Heading className="headline text-3xl text-foreground">{t("errorTitle")}</Heading>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message ?? t("errorText")}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 py-2.5 text-sm font-bold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-line bg-card/50 px-6 py-16 text-center">
      <SearchX className="h-8 w-8 text-brand" aria-hidden="true" />
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">{title}</h2>
        {text && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>}
      </div>
      {action}
    </div>
  );
}
