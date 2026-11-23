import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PageHero, PolicyLayout, PolicySection } from "@/components/site/PageHero";

export default function EditorialPolicy() {
  const { t } = useI18n();
  usePageMeta({
    title: "Editorial policy and AI standards — Buddha News",
    description:
      "How Buddha Media Group sources, corrects and publishes journalism, and how AI is used in the newsroom.",
  });

  return (
    <div>
      <PageHero
        kicker="Editorial standards"
        title="The record has to be worth trusting."
        intro={t("editorialIntro")}
        accent="var(--teal)"
      />
      <PolicyLayout>
        <PolicySection title="Sourcing and verification">
          <p>{t("editorialSourcing")}</p>
          <p>
            We distinguish what we know, what we have been told, and what we cannot yet verify.
            Allegations are attributed. Numbers are checked against the original document or dataset.
            When a source is at risk, we explain why they are not named.
          </p>
        </PolicySection>
        <PolicySection title={t("correctionsPolicy")}>
          <p>{t("editorialCorrections")}</p>
          <p>
            A correction states what was wrong and what is now correct. Substantive changes are
            timestamped. Complaints can be sent through the contact page and are reviewed by an
            editor who was not involved in the original story.
          </p>
        </PolicySection>
        <PolicySection title={t("aiPolicy")}>
          <p>{t("editorialAi")}</p>
          <ul>
            <li>AI may draft a summary, suggest a headline, propose tags or produce a first translation.</li>
            <li>AI may not invent quotes, sources, numbers or events, and may not publish without an editor.</li>
            <li>AI-generated summaries are labelled on the story and can be regenerated or removed.</li>
            <li>Questions sent to Buddha AI are processed by a configured model; do not send sensitive personal data.</li>
          </ul>
          <p>
            The newsroom may use AI-generated illustrations for some stories. They are illustrative,
            not documentary photographs, and are labelled in the caption. Editors do not present a
            generated image as a photograph of a real event.
          </p>
        </PolicySection>
        <PolicySection title={t("ownership")}>
          <p>{t("editorialOwnership")}</p>
          <p>{t("funding")}: reader support, syndication and disclosed partnerships. A funder never
            gets copy approval. Any relationship that could reasonably affect coverage is disclosed
            on the story or on the About page.</p>
        </PolicySection>
        <PolicySection title={t("editorialComplaints")}>
          <p>
            Send complaints, correction requests and legal notices through the contact page. Include
            the story link and the specific passage. We aim to acknowledge within two working days and
            resolve within five.
          </p>
        </PolicySection>
      </PolicyLayout>
    </div>
  );
}
