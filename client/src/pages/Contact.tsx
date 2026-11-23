import { useState, type FormEvent } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { pagePath } from "@/lib/news";
import { PageHero } from "@/components/site/PageHero";
import { TurnstileWidget, turnstileSiteKey } from "@/components/site/TurnstileWidget";

export default function Contact() {
  const { t, locale } = useI18n();
  const [sent, setSent] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  usePageMeta({
    title: "Contact the newsroom — Buddha News",
    description: "Contact Buddha Media Group with story tips, corrections, partnerships or privacy questions.",
  });

  const contactEmail = "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    if (turnstileSiteKey() && !token) return;

    const honeypot = String(data.get("website") ?? "").trim();
    if (honeypot) {
      setSent(true);
      form.reset();
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          subject: String(data.get("subject") ?? ""),
          message: String(data.get("message") ?? ""),
          locale,
          turnstileToken: token ?? undefined,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || t("messageError"));
      }

      setSent(true);
      form.reset();
      toast.success(result.message || t("messageSent"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("messageError");
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
      setResetSignal((value) => value + 1);
    }
  }

  return (
    <div>
      <PageHero
        kicker={t("contact")}
        title="Talk to the newsroom."
        titleLang="en"
        titleDir="ltr"
        intro="Corrections, story tips, partnership requests and privacy questions all reach the same desk. Sensitive tips should use the secure tip line, not this form."
        introLang="en"
        introDir="ltr"
      />
      <div className="container-news grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-card p-6">
          {sent ? (
            <div className="py-10 text-center" role="status">
              <ShieldCheck className="mx-auto h-10 w-10 text-teal" />
              <h2 className="font-display mt-3 text-2xl font-semibold text-foreground">{t("messageSent")}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                We read every message. A reply usually takes two to five working days.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-5 rounded-md border border-line px-4 py-2 text-xs font-bold text-foreground"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} onFocusCapture={() => setEngaged(true)} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-foreground">
                  {t("name")}
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    className="h-11 rounded-md border border-line bg-background px-3 text-sm font-normal text-foreground focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-foreground">
                  {t("email")}
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={320}
                    autoComplete="email"
                    className="h-11 rounded-md border border-line bg-background px-3 text-sm font-normal text-foreground focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-xs font-bold text-foreground">
                {t("subject")}
                <input
                  name="subject"
                  required
                  minLength={3}
                  maxLength={200}
                  className="h-11 rounded-md border border-line bg-background px-3 text-sm font-normal text-foreground focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-foreground">
                {t("messageLabel")}
                <textarea
                  name="message"
                  required
                  minLength={20}
                  maxLength={4000}
                  rows={7}
                  className="rounded-md border border-line bg-background px-3 py-2 text-sm font-normal text-foreground focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                />
              </label>
              <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {engaged && (
                <TurnstileWidget onToken={setToken} resetSignal={resetSignal} language={locale} />
              )}
              {errorMessage && (
                <p className="text-xs font-semibold text-destructive" role="alert">
                  {errorMessage}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.66rem] leading-relaxed text-muted-foreground">
                  By sending this form you agree to our{" "}
                  <Link href={pagePath(locale, "privacy")} className="link-underline text-teal">{t("privacy")}</Link>.
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting || (Boolean(turnstileSiteKey()) && !token)}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-ink px-5 text-sm font-extrabold text-paper disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("sendMessage")}
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          {contactEmail && (
            <div className="rounded-lg border border-line bg-card p-5">
              <Mail className="h-5 w-5 text-brand" />
              <h2 className="font-display mt-2 text-lg font-semibold text-foreground">{t("email")}</h2>
              <a href={`mailto:${contactEmail}`} className="mt-1 block break-all text-sm font-semibold text-teal hover:text-brand">
                {contactEmail}
              </a>
              <p className="mt-2 text-xs text-muted-foreground">
                For non-sensitive messages. Replies usually take two to five working days.
              </p>
            </div>
          )}
          <div className="rounded-lg border border-brand/30 bg-brand/10 p-5">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <h2 className="font-display mt-2 text-lg font-semibold text-foreground">{t("tipLine")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("tipIntro")}</p>
            <Link href={pagePath(locale, "tip-line")} className="mt-3 inline-flex text-sm font-bold text-teal hover:text-brand">
              {t("tipSteps")} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
            </Link>
          </div>
          <div className="rounded-lg border border-line bg-card p-5">
            <p className="kicker text-brand">Corrections</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Include the story link, the sentence, and what you believe is incorrect. We check
              against the original sourcing before changing the record.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
