import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { CATEGORIES, localePath } from "@shared/news";
import { categoryPath, pagePath } from "@/lib/news";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "./Logo";
import { SearchDialog } from "./SearchDialog";

export function SiteHeader() {
  const { t, locale, setLocale, formatDate } = useI18n();
  const { theme, toggleTheme, switchable } = useTheme();
  const [location] = useLocation();
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setOpenCategory(null);
    };
    const onClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenCategory(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const isActive = (key: string) =>
    location === `/${locale}/category/${key}` ||
    location.startsWith(`/${locale}/category/${key}?`);

  return (
    <>
      <header className="border-b border-line bg-background">
        <div className="container-news flex min-h-9 items-center justify-between gap-3 py-1.5 text-[0.68rem] font-semibold">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span className="hidden whitespace-nowrap sm:inline">{formatDate(new Date())}</span>
            <span className="hidden text-line sm:inline" aria-hidden="true">|</span>
            <span className="truncate text-[0.66rem] uppercase tracking-[0.12em] text-brand">
              {t("independence")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div
              className="flex items-center rounded border border-line bg-card p-0.5"
              role="group"
              aria-label={t("language")}
            >
              {(["en", "ps", "fa"] as const).map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-pressed={locale === code}
                  className={cn(
                    "min-h-11 min-w-11 rounded px-2 text-[0.66rem] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                    locale === code
                      ? "bg-ink text-paper"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  lang={code === "en" ? "en" : code}
                >
                  {code === "en" ? "EN" : code === "ps" ? "پښتو" : "دری"}
                </button>
              ))}
            </div>
            {switchable && toggleTheme && (
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-11 w-11 items-center justify-center rounded border border-line bg-card text-muted-foreground transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                aria-label={`${t("theme")}: ${theme === "dark" ? t("light") : t("dark")}`}
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            )}
            <Link
              href={pagePath(locale, "tip-line")}
              className="hidden min-h-11 items-center gap-1 rounded px-2 text-muted-foreground transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:inline-flex"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tipLine")}
            </Link>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-50 border-b border-line bg-background/90 backdrop-blur-xl">
        <div className="container-news flex h-[66px] items-center justify-between gap-3">
          <Logo />

          <nav
            ref={navRef}
            className="hidden items-center xl:flex"
            aria-label={t("menu")}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setOpenCategory(null);
              }
            }}
            onKeyDown={event => {
              if (event.key === "Escape" && openCategory) {
                event.preventDefault();
                event.stopPropagation();
                navRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.focus();
                setOpenCategory(null);
              }
            }}
          >
            <Link
              href={localePath(locale, "/")}
              aria-current={location === `/${locale}/` || location === `/${locale}` ? "page" : undefined}
              className={cn(
                "inline-flex h-[66px] items-center whitespace-nowrap border-b-2 px-2.5 text-[0.79rem] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand xl:px-3",
                location === `/${locale}/` || location === `/${locale}`
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t("home")}
            </Link>
            {CATEGORIES.map((category, index) => (
              <div
                key={category.key}
                className="relative"
                onMouseEnter={() => setOpenCategory(category.key)}
                onMouseLeave={event => {
                  if (!event.currentTarget.contains(document.activeElement)) setOpenCategory(null);
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenCategory(current => (current === category.key ? null : category.key))}
                  aria-expanded={openCategory === category.key}
                  aria-controls={openCategory === category.key ? `nav-${category.key}` : undefined}
                  className={cn(
                    "inline-flex h-[66px] items-center gap-1 whitespace-nowrap border-b-2 px-2 text-[0.79rem] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand xl:px-2.5",
                    isActive(category.key)
                      ? "border-brand text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {category.label[locale]}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      openCategory === category.key && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>

                {openCategory === category.key && (
                  <div
                    id={`nav-${category.key}`}
                    className={cn(
                      "absolute top-full z-[60] w-[360px] rounded-b-lg border border-t-0 border-line bg-card p-3 shadow-[0_24px_60px_-24px_rgba(21,26,32,0.45)]",
                      index >= CATEGORIES.length - 3 ? "end-0" : "start-0"
                    )}
                  >
                    <Link
                      href={categoryPath(locale, category.key)}
                      onClick={() => setOpenCategory(null)}
                      className="mb-2 flex min-h-11 items-center justify-between rounded-md bg-muted px-3 py-2 text-xs font-extrabold text-foreground hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {t("allStories")} · {category.label[locale]}
                      <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
                    </Link>
                    <div className="grid grid-cols-2 gap-1">
                      {category.subcategories.map(sub => (
                        <Link
                          key={sub.key}
                          href={categoryPath(locale, category.key, sub.key)}
                          onClick={() => setOpenCategory(null)}
                          className="flex min-h-11 items-center rounded px-2 py-2 text-[0.74rem] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          {sub.label[locale]}
                        </Link>
                      ))}
                      {category.subcategories.length === 0 && (
                        <Link
                          href={categoryPath(locale, category.key)}
                          onClick={() => setOpenCategory(null)}
                          className="flex min-h-11 items-center rounded px-2 py-2 text-[0.74rem] font-semibold text-muted-foreground hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          {t("latest")}
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              data-site-search-trigger
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={t("search")}
            >
              <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand xl:hidden"
              aria-label={t("menu")}
              aria-expanded={mobileOpen}
              aria-haspopup="dialog"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          showCloseButton={false}
          className="left-0 top-0 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 sm:max-w-none"
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (!searchOpen) mobileMenuButtonRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">{t("menu")}</DialogTitle>
          <DialogDescription className="sr-only">{t("tagline")}</DialogDescription>
          <div className="flex h-full flex-col bg-background">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                aria-label={t("close")}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setSearchOpen(true);
                }}
                className="mb-3 flex w-full items-center gap-3 rounded-md border border-line bg-card px-4 py-3 text-sm font-semibold text-muted-foreground"
              >
                <Search className="h-4 w-4" aria-hidden="true" /> {t("searchPlaceholder")}
              </button>
              <Link
                href={localePath(locale, "/")}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-11 items-center justify-between border-b border-line py-3 text-sm font-extrabold text-foreground"
              >
                {t("home")}
                <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
              </Link>
              {CATEGORIES.map(category => (
                <details key={category.key} className="group border-b border-line">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-3 text-sm font-extrabold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                    {category.label[locale]}
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="grid grid-cols-2 gap-1 pb-3">
                    <Link
                      href={categoryPath(locale, category.key)}
                      onClick={() => setMobileOpen(false)}
                      className="col-span-2 flex min-h-11 items-center rounded bg-muted px-3 py-2 text-xs font-extrabold text-foreground"
                    >
                      {t("allStories")}
                    </Link>
                    {category.subcategories.map(sub => (
                      <Link
                        key={sub.key}
                        href={categoryPath(locale, category.key, sub.key)}
                        onClick={() => setMobileOpen(false)}
                        className="flex min-h-11 items-center rounded px-2 py-2 text-xs font-semibold text-muted-foreground"
                      >
                        {sub.label[locale]}
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-bold">
                <Link href={pagePath(locale, "about")} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center rounded border border-line px-3 py-2">
                  {t("about")}
                </Link>
                <Link href={pagePath(locale, "contact")} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center rounded border border-line px-3 py-2">
                  {t("contact")}
                </Link>
                <Link href={pagePath(locale, "tip-line")} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center rounded border border-line px-3 py-2">
                  {t("tipLine")}
                </Link>
                <Link href={pagePath(locale, "editorial-policy")} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center rounded border border-line px-3 py-2">
                  {t("editorial")}
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("language")}>
                {(["en", "ps", "fa"] as const).map(code => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    aria-pressed={locale === code}
                    className={cn(
                      "min-h-11 rounded px-3 py-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                      locale === code ? "bg-ink text-paper" : "text-muted-foreground"
                    )}
                    lang={code}
                  >
                    {code === "en" ? "English" : code === "ps" ? "پښتو" : "دری"}
                  </button>
                ))}
              </div>
              {switchable && toggleTheme && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex min-h-11 items-center gap-2 rounded border border-line px-3 text-xs font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? t("light") : t("dark")}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
