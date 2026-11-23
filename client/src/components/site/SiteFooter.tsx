import { Facebook, Mail, Rss, Twitter, Youtube } from "lucide-react";
import { Link } from "wouter";
import { CATEGORIES, SITE, type PublicPage } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { categoryPath, pagePath } from "@/lib/news";
import { trpc } from "@/lib/trpc";
import { LotusMark } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";

const COMPANY_LINKS = [
  { page: "about", key: "about" },
  { page: "contact", key: "contact" },
  { page: "editorial-policy", key: "editorial" },
  { page: "tip-line", key: "tipLine" },
  { page: "privacy", key: "privacy" },
  { page: "terms", key: "terms" },
] as const;

export function SiteFooter() {
  const { t, locale } = useI18n();
  const { data: settings } = trpc.settings.public.useQuery(undefined, { staleTime: 300_000 });
  const socials = [
    settings?.youtubeUrl ? { href: settings.youtubeUrl, label: "YouTube", icon: Youtube } : null,
    settings?.twitterUrl ? { href: settings.twitterUrl, label: "X", icon: Twitter } : null,
    settings?.facebookUrl ? { href: settings.facebookUrl, label: "Facebook", icon: Facebook } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof Youtube }>;

  return (
    <footer className="news-footer border-t border-[#2a333d] bg-[#151a20] text-[#f6f1e8]">
      <div className="container-news grid gap-10 py-14 lg:grid-cols-[1.35fr_1fr_1fr_1.25fr]">
        <div>
          <div className="flex items-center gap-3">
            <LotusMark inverted className="h-11 w-11" />
            <div>
              <p className="font-display text-2xl font-semibold leading-none">Buddha News</p>
              <p className="mt-1.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand">
                Buddha Media Group
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#a7b0ba]">{t("footerNote")}</p>
          <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-brand">
            {t("independence")}
          </p>
          <div className="mt-5 flex items-center gap-2">
            {socials.map(social => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 w-11 items-center justify-center rounded border border-[#2a333d] text-[#f6f1e8]/80 transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                aria-label={social.label}
              >
                <social.icon className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
            <a
              href={`/${locale}/rss.xml`}
              className="inline-flex h-11 w-11 items-center justify-center rounded border border-[#2a333d] text-[#f6f1e8]/80 transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              aria-label="RSS"
            >
              <Rss className="h-4 w-4" aria-hidden="true" />
            </a>
            {(settings?.contactEmail ?? SITE.email) && (
              <a
                href={`mailto:${settings?.contactEmail ?? SITE.email}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded border border-[#2a333d] text-[#f6f1e8]/80 transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                aria-label={t("email")}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        <nav aria-label={t("sections")}>
          <h2 className="kicker mb-4 text-brand">{t("sections")}</h2>
          <ul className="grid gap-2.5">
            {CATEGORIES.map(category => (
              <li key={category.key}>
                <Link
                  href={categoryPath(locale, category.key)}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-[#f6f1e8]/75 transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {category.label[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("company")}>
          <h2 className="kicker mb-4 text-brand">{t("company")}</h2>
          <ul className="grid gap-2.5">
            {COMPANY_LINKS.map(link => (
              <li key={link.page}>
                <Link
                  href={pagePath(locale, link.page as PublicPage)}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-[#f6f1e8]/75 transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="kicker mb-4 text-brand">{t("newsletterTitle")}</h2>
          <p className="mb-4 text-sm leading-relaxed text-[#a7b0ba]">{t("newsletterText")}</p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-[#2a333d]">
        <div className="container-news flex flex-col gap-3 py-5 text-[0.7rem] font-medium text-[#a7b0ba] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.legalName}. {t("rights")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href={pagePath(locale, "privacy")} className="inline-flex min-h-11 items-center hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              {t("privacy")}
            </Link>
            <Link href={pagePath(locale, "terms")} className="inline-flex min-h-11 items-center hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              {t("terms")}
            </Link>
            <Link href="/admin" className="inline-flex min-h-11 items-center hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              {t("newsroomLogin")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
