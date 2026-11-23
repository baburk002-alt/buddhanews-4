import { useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { Loader2, Mail } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { pagePath } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { TurnstileWidget, turnstileSiteKey } from "./TurnstileWidget";

type Feedback = "confirmed" | "invalid" | "unsubscribed" | null;

function feedbackFrom(search: string): Feedback {
  const value = new URLSearchParams(search).get("newsletter");
  if (value === "confirmed" || value === "invalid" || value === "unsubscribed") return value;
  return null;
}

const FEEDBACK_COPY = {
  confirmed: { key: "newsletterConfirmed", tone: "success" },
  invalid: { key: "newsletterInvalid", tone: "error" },
  unsubscribed: { key: "unsubscribed", tone: "muted" },
} as const;

export function NewsletterForm({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const search = useSearch();
  const feedback = feedbackFrom(search);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  // Honeypot: real visitors never see or fill this field.
  const [company, setCompany] = useState("");
  const needsChallenge = Boolean(turnstileSiteKey());
  const [engaged, setEngaged] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const subscribe = trpc.newsletter.subscribe.useMutation({
    onSuccess: result => {
      if (result.status === "already") {
        setDone(true);
        return;
      }
      setDone(true);
      setEmail("");
      setConsent(false);
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !consent) return;
    if (needsChallenge && !token) return;
    subscribe.mutate(
      {
        email: email.trim(),
        locale,
        consent: true,
        company,
        turnstileToken: token ?? undefined,
      },
      {
        // A Turnstile token is single-use: always ask for a fresh one.
        onSettled: () => setResetSignal(value => value + 1),
      }
    );
  }

  if (feedback) {
    const copy = FEEDBACK_COPY[feedback];
    return (
      <p
        className={cn(
          "rounded-md border px-4 py-3 text-sm font-semibold",
          copy.tone === "success" && "border-brand/40 bg-brand/10 text-foreground",
          copy.tone === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
          copy.tone === "muted" && "border-line bg-muted text-muted-foreground",
          className
        )}
        data-newsletter-feedback
        role="status"
      >
        {t(copy.key)}
      </p>
    );
  }

  if (done) {
    return (
      <p
        className={cn(
          "rounded-md border border-brand/40 bg-brand/10 px-4 py-3 text-sm font-semibold text-foreground",
          className
        )}
        data-newsletter-feedback
        role="status"
      >
        {subscribe.data?.status === "already" ? t("subscribed") : t("newsletterPending")}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      onFocusCapture={() => setEngaged(true)}
      className={cn("w-full", className)}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{t("email")}</span>
          <Mail className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder={t("emailPlaceholder")}
            className="h-11 w-full min-w-0 rounded-md border border-line bg-card ps-10 pe-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-brand"
            aria-label={t("emailPlaceholder")}
            aria-invalid={Boolean(subscribe.error)}
            aria-describedby={subscribe.error ? "newsletter-submit-error" : undefined}
          />
        </label>
        <button
          type="submit"
          disabled={subscribe.isPending || (needsChallenge && !token)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-extrabold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
        >
          {subscribe.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {subscribe.isPending ? t("subscribing") : t("subscribe")}
        </button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-[0.72rem] leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={event => setConsent(event.target.checked)}
          required
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-line accent-[var(--brand)]"
        />
        <span>
          {t("newsletterConsent")}{" "}
          <Link href={pagePath(locale, "privacy")} className="link-underline text-teal">
            {t("privacy")}
          </Link>
        </span>
      </label>
      <p className="mt-2 text-[0.7rem] text-muted-foreground">{t("newsletterPrivacy")}</p>
      <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0">
        <label>
          Company
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={event => setCompany(event.target.value)}
          />
        </label>
      </div>
      {engaged && needsChallenge && (
        <TurnstileWidget className="mt-3" onToken={setToken} resetSignal={resetSignal} language={locale} />
      )}
      {subscribe.error && (
        <p id="newsletter-submit-error" className="mt-2 text-[0.72rem] font-semibold text-destructive" role="alert">
          {subscribe.error.message || t("newsletterError")}
        </p>
      )}
    </form>
  );
}
