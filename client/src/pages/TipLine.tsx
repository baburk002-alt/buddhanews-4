import { AlertTriangle, FileText, Lock, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { pagePath } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { PageHero } from "@/components/site/PageHero";

export default function TipLine() {
  const { t, locale } = useI18n();
  usePageMeta({
    title: "Secure tip line — Buddha News",
    description: "How to reach Buddha Media Group safely with sensitive information.",
  });
  const settingsQuery = trpc.settings.public.useQuery(undefined, { staleTime: 300_000 });
  const signal = settingsQuery.data?.tipSignal?.trim();
  const signalHref = signal
    ? signal.startsWith("http")
      ? signal
      : `https://signal.me/#p/${encodeURIComponent(signal.replace(/\s+/g, ""))}`
    : null;

  return (
    <div>
      <PageHero
        kicker={t("tipLine")}
        title="Protect the story. Protect yourself."
        titleLang="en"
        titleDir="ltr"
        intro={t("tipIntro")}
        accent="var(--teal)"
      />
      <div className="container-news grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {!signalHref && (
            <div className="mb-6 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-extrabold text-foreground">No verified Signal channel is published yet.</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("tipWarning")}</p>
              </div>
            </div>
          )}

          <section className="rounded-lg border border-line bg-card p-6">
            <ShieldCheck className="h-6 w-6 text-teal" aria-hidden="true" />
            <h2 className="font-display mt-3 text-2xl font-semibold text-foreground">{t("tipSteps")}</h2>
            <div className="mt-5 grid gap-4">
              {[
                {
                  icon: Smartphone,
                  title: "Choose a channel that fits the risk",
                  text: t("tipSecureChannels"),
                },
                {
                  icon: FileText,
                  title: "Send the material, not your life story",
                  text: t("tipWhatToSend"),
                },
                {
                  icon: Trash2,
                  title: "Leave less behind",
                  text: t("tipProtectYourself"),
                },
                {
                  icon: Lock,
                  title: "Never use ordinary email for a sensitive tip",
                  text: t("tipNoEmail"),
                },
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-line bg-card p-6">
            <h2 className="font-display text-xl font-semibold text-foreground">What BMG will never ask for</h2>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <li>• A password, a one-time code, or access to your account.</li>
              <li>• Payment to “verify” a tip or to unlock a story.</li>
              <li>• Your real name before you have decided it is safe to give it.</li>
              <li>• A meeting in a place you do not choose.</li>
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-teal/40 bg-teal/5 p-5">
            <p className="kicker text-teal">{t("tipSignalLabel")}</p>
            {signalHref ? (
              <a
                href={signalHref}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex min-h-11 items-center text-lg font-extrabold text-foreground underline decoration-brand underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                Open Signal <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Not configured. The newsroom owner can add a verified number in Settings before
                publishing this page.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Verify the number through a second channel before sending anything sensitive.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <p className="kicker text-brand">Non-sensitive messages</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use the contact form for corrections, events and general questions. It is rate-limited
              and logged for security, so it is not a secure channel.
            </p>
            <Link href={pagePath(locale, "contact")} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-teal hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              {t("contactUs")} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
            </Link>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <p className="kicker text-brand">PGP</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              BMG will publish a PGP key only after it has been generated and verified offline. A
              placeholder key is worse than no key, so none is shown here.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
