import { useEffect, useState, type ReactNode } from "react";
import {
BarChart3,
ExternalLink,
FileText,
LogOut,
Menu,
Plus,
X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";
import AdminLogin from "@/pages/admin/AdminLogin";
import { LotusMark } from "@/components/site/Logo";
import { clearAdminToken, getAdminToken } from "@/lib/adminAuth";

type NavItem = {
href: string;
label: string;
icon: typeof FileText;
};

const NAV: NavItem[] = [
{ href: "/admin/articles", label: "Stories", icon: FileText },
{ href: "/admin/articles/new", label: "New story", icon: Plus },
];

export function AdminLayout({ children }: { children: ReactNode }) {
const [location, navigate] = useLocation();
const [mobileOpen, setMobileOpen] = useState(false);
const [authenticated, setAuthenticated] = useState<boolean>(() => Boolean(getAdminToken()));

useEffect(() => {
const sync = () => setAuthenticated(Boolean(getAdminToken()));
window.addEventListener("buddhanews-admin-auth", sync);
window.addEventListener("storage", sync);
return () => {
  window.removeEventListener("buddhanews-admin-auth", sync);
  window.removeEventListener("storage", sync);
};
}, []);

usePageMeta({
title: "Newsroom — Buddha News",
description: "Private editorial dashboard.",
noindex: true,
});

if (!authenticated) {
return <AdminLogin />;
}

function handleLogout() {
clearAdminToken();
setAuthenticated(false);
navigate("/admin", { replace: true });
}

const sidebar = (
<aside className="flex h-full w-[250px] flex-col bg-[#151a20] text-[#f6f1e8]">
  <div className="flex items-center justify-between border-b border-[#2a333d] px-4 py-4">
    <Link href="/admin/articles" className="flex items-center gap-2.5">
      <LotusMark inverted className="h-9 w-9" />
      <div>
        <p className="font-display text-lg font-semibold leading-none">Buddha</p>
        <p className="mt-1 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-brand">Newsroom</p>
      </div>
    </Link>
    <button
      type="button"
      onClick={() => setMobileOpen(false)}
      className="inline-flex h-8 w-8 items-center justify-center rounded text-[#a7b0ba] lg:hidden"
      aria-label="Close menu"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
  <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Newsroom">
    <p className="mb-2 px-3 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-[#a7b0ba]">Workspace</p>
    {NAV.map(item => {
      const active = location === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "mb-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.8rem] font-semibold transition-colors",
            active ? "bg-white/10 text-brand" : "text-[#f6f1e8]/70 hover:bg-white/5 hover:text-[#f6f1e8]"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      );
    })}
    <p className="mb-2 mt-6 px-3 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-[#a7b0ba]">Public site</p>
    <a
      href="/en/"
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.8rem] font-semibold text-[#f6f1e8]/70 hover:bg-white/5 hover:text-[#f6f1e8]"
    >
      <ExternalLink className="h-4 w-4" /> View live site
    </a>
  </nav>
  <div className="border-t border-[#2a333d] p-3">
    <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[0.7rem] font-extrabold text-brand-foreground">
        BMG
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold">Editor</p>
        <p className="truncate text-[0.62rem] text-[#a7b0ba]">D1 Admin</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-[#a7b0ba] hover:text-brand"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  </div>
</aside>
);

return (
<div className="admin-shell">
  <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
  {mobileOpen && (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <div className="relative h-full">{sidebar}</div>
    </div>
  )}

  <div className="lg:pl-[250px]">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-background/90 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <BarChart3 className="h-4 w-4 text-brand" /> Editorial desk
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="/en/"
          target="_blank"
          rel="noreferrer noopener"
          className="hidden items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-[0.68rem] font-bold text-foreground sm:inline-flex"
        >
          View site <ExternalLink className="h-3 w-3" />
        </a>
        <Link
          href="/admin/articles/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[0.68rem] font-extrabold text-paper"
        >
          <Plus className="h-3.5 w-3.5" /> New story
        </Link>
      </div>
    </header>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
  </div>
</div>
);
}
