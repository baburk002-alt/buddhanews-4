import { Link } from "wouter";
import { ArrowUpRight, Languages, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { pagePath } from "@/lib/news";
import { PageHero, PolicySection } from "@/components/site/PageHero";

const STUDIO_IMAGE = "/manus-storage/async-images/YXI3U8B7PmDNHU8a8gDjhr/image-4.webp";

export default function About() {
  const { t, locale } = useI18n();
  usePageMeta({
    title: t("aboutPageTitle"),
    description: t("aboutPageDescription"),
  });

  return (
    <div>
      <PageHero
        kicker={t("aboutPageKicker")}
        title={t("aboutHeroTitle")}
        intro={t("aboutHeroIntro")}
      />

      <div className="container-news grid gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <PolicySection title={t("ourMission")}>
            <p>{t("aboutMissionFirst")}</p>
            <p>{t("aboutMissionSecond")}</p>
          </PolicySection>
          <PolicySection title={t("ourTeam")}>
            <p>{t("aboutNewsroomFirst")}</p>
            <p>{t("aboutNewsroomSecond")}</p>
          </PolicySection>
          <PolicySection title={t("ownership")}>
            <p>{t("aboutOwnershipText")}</p>
          </PolicySection>
        </div>

        <aside className="space-y-4">
          <img
            src={STUDIO_IMAGE}
            alt={t("aboutStudioAlt")}
            className="aspect-[4/3] w-full rounded-lg border border-line bg-muted object-cover"
            loading="lazy"
            onError={event => {
              // /manus-storage/* only resolves where storage is configured; fall back to the bundled brand card.
              const img = event.currentTarget;
              if (!img.src.endsWith("/og-fallback.svg")) img.src = "/og-fallback.svg";
            }}
          />
          <div className="grid gap-3">
            {[
              { icon: Languages, title: t("aboutLanguageTitle"), text: t("aboutLanguageText") },
              { icon: ShieldCheck, title: t("aboutSecurityTitle"), text: t("aboutSecurityText") },
              { icon: Sparkles, title: t("aboutAiTitle"), text: t("aboutAiText") },
            ].map(item => (
              <div key={item.title} className="rounded-lg border border-line bg-card p-4">
                <item.icon className="h-5 w-5 text-brand" />
                <p className="mt-2 text-sm font-extrabold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-brand/30 bg-brand/10 p-5">
            <p className="kicker text-brand">{t("contact")}</p>
            <p className="mt-2 text-sm text-foreground">
              {t("aboutContactText")}
            </p>
            <Link href={pagePath(locale, "contact")} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-teal hover:text-brand">
              {t("contactUs")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
