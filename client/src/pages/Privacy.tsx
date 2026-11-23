import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PageHero, PolicyLayout, PolicySection } from "@/components/site/PageHero";

const ROWS = [
  {
    data: "Contact form",
    fields: "Name, email, subject, message, language",
    why: "To read and answer your message",
    keep: "Until the request is resolved and no longer needed",
  },
  {
    data: "Newsletter",
    fields: "Email address, language preference, consent time, confirmation status",
    why: "To send the BMG Brief after you confirm your address",
    keep: "Until you unsubscribe; confirmation links expire after 48 hours and unconfirmed records are pruned after 14 days",
  },
  {
    data: "Article views",
    fields: "Article, language, a daily keyed pseudonym derived from network and browser data",
    why: "To count one read per visitor per day without ad tracking",
    keep: "90 days by default, then deleted; only aggregate counts remain",
  },
  {
    data: "Security logs",
    fields: "Admin account, action, a keyed network fingerprint, browser string, time",
    why: "To detect and investigate misuse of the newsroom",
    keep: "365 days by default, then deleted",
  },
  {
    data: "Browser storage",
    fields: "Language and light/dark theme",
    why: "To remember your reading preferences",
    keep: "Until you clear your browser",
  },
];

export default function Privacy() {
  const { t, locale } = useI18n();
  const { data: settings } = trpc.settings.public.useQuery(undefined, { staleTime: 300_000 });
  const contactEmail = settings?.contactEmail?.trim() ?? "";
  usePageMeta({
    title: "Privacy — Buddha News",
    description: "What Buddha News stores, why, and how to exercise your data rights.",
  });

  return (
    <div>
      <PageHero kicker="Privacy" title="A newsroom should collect less, not more." intro={t("privacyIntro")} />
      <PolicyLayout>
        <PolicySection title="What we store">
          <p>{t("privacyData")}</p>
          <div className="not-prose mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] border-collapse text-start text-sm">
              <thead className="bg-muted text-[0.66rem] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-extrabold">Data</th>
                  <th className="px-3 py-2 font-extrabold">Fields</th>
                  <th className="px-3 py-2 font-extrabold">Why</th>
                  <th className="px-3 py-2 font-extrabold">Retention</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(row => (
                  <tr key={row.data} className="border-t border-line align-top">
                    <td className="px-3 py-3 font-bold text-foreground">{row.data}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.fields}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.why}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.keep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PolicySection>
        <PolicySection title="Cookies and local storage">
          <p>{t("privacyCookies")}</p>
          <p>
            The newsroom session is an HTTP-only, SameSite=Lax cookie. It is marked Secure whenever
            the site is served over HTTPS, expires after 12 hours (or 4 hours of inactivity), and can
            be revoked immediately by an administrator. Your language and light/dark preference are
            stored in your browser, not sent to advertisers.
          </p>
          <p>
            Newsletter sign-up uses double opt-in: we store your address as pending and send one
            confirmation email. Nothing is sent to the briefing list until you click that link. Every
            email includes a signed unsubscribe link that works without a password.
          </p>
        </PolicySection>
        <PolicySection title="AI features">
          <p>
            When you ask Buddha AI a question, the question and a short list of recent headlines are
            sent to the configured language-model provider to produce an answer. Do not include
            personal or sensitive information in an AI question. AI summaries are generated from the
            article text and stored with the story. AI usage is metered per day so the service cannot
            run up an unlimited bill; prompts are not used to build advertising profiles.
          </p>
        </PolicySection>
        <PolicySection title="Your rights">
          <p>{t("privacyRights")}</p>
          <p>
            {contactEmail ? (
              <>
                Write to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
              </>
            ) : (
              <>
                Use the <a href={`/${locale}/contact`}>{t("privacyContact")}</a> page.
              </>
            )}{" "}
            Include enough detail for us to find the record, but never send a password or ID document by
            ordinary email.
          </p>
        </PolicySection>
        <PolicySection title="Security">
          <p>
            Access to the newsroom is limited to authorized accounts. Privileged actions are logged.
            We use rate limiting, input validation, upload inspection and security headers. No system
            is perfectly secure; if you find a vulnerability, contact the newsroom privately before
            publishing it.
          </p>
        </PolicySection>
      </PolicyLayout>
    </div>
  );
}
