import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PageHero, PolicyLayout, PolicySection } from "@/components/site/PageHero";

export default function Terms() {
  const { t } = useI18n();
  usePageMeta({
    title: "Terms of use — Buddha News",
    description: "The terms that apply when you read, link to or quote Buddha News.",
  });

  return (
    <div>
      <PageHero kicker="Terms" title="Clear terms, in plain language." intro={t("termsIntro")} />
      <PolicyLayout>
        <PolicySection title="Using the site">
          <p>{t("termsUse")}</p>
          <p>
            Automated scraping that degrades the service, attempts to bypass access controls, or
            republishes the archive without permission is not allowed.
          </p>
        </PolicySection>
        <PolicySection title="Editorial content">
          <p>{t("termsContent")}</p>
          <p>
            Opinion is labelled. Sponsored or partnership content is labelled and kept separate from
            news reporting. AI-generated summaries are marked and remain subject to human review.
          </p>
        </PolicySection>
        <PolicySection title="No warranty">
          <p>{t("termsLiability")}</p>
          <p>
            Links to other sites are provided for context. BMG is not responsible for their content
            or privacy practices.
          </p>
        </PolicySection>
        <PolicySection title="Accounts and the newsroom">
          <p>
            Newsroom accounts are for authorized staff only. Do not share credentials. The owner may
            suspend access and review security logs when misuse is suspected.
          </p>
        </PolicySection>
        <PolicySection title="Changes">
          <p>{t("termsChanges")}</p>
          <p>Continued use after a change means you accept the updated terms.</p>
        </PolicySection>
      </PolicyLayout>
    </div>
  );
}
