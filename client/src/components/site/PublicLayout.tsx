import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AIAssistant } from "./AIAssistant";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { Ticker } from "./Ticker";
import { useI18n } from "@/contexts/I18nContext";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <div className="flex min-h-screen flex-col">
      <a className="skip-link" href="#main-content">{t("skip")}</a>
      <SiteHeader />
      <Ticker />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <AIAssistant />
    </div>
  );
}
