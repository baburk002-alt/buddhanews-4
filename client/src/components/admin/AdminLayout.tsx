import { useEffect, useState, type ReactNode } from "react";
import { purgeDrafts } from "@/lib/drafts";
import {
  BarChart3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";
import AdminLogin from "@/pages/admin/AdminLogin";
import { LotusMark } from "@/components/site/Logo";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Settings, subscribers, the audit trail and role management are owner-level. */
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/articles", label: "Stories", icon: FileText },
  { href: "/admin/articles/new", label: "New story", icon: Plus },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/messages", label: "Messages", icon: Inbox },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users, adminOnly: true },
  { href: "/admin/audit", label: "Audit log", icon: Shield, adminOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout, isAdmin, isEditor } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // TTL cleanup: drop expired, legacy and other users' drafts; wipe everything
  // when the session is gone (expired cookie, revoked session, other tab).
  useEffect(() => {
    if (loading) return;
    purgeDrafts(user ? user.id : null);
  }, [loading, user]);
  usePageMeta({
    title: "Newsroom — Buddha News",
    description: "Private editorial dashboard.",
    noindex: true,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  if (!isEditor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
          <Shield className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="font-display mt-4 text-2xl font-semibold">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This account does not have newsroom access. Contact the owner or sign out.
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-5 rounded-md bg-ink px-5 py-2.5 text-sm font-bold text-paper"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const initials = (user.name ?? "BMG")
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const items = NAV.filter(item => !item.adminOnly || isAdmin);
  const roleLabel = user.isOwner ? "Owner" : isAdmin ? "Administrator" : "Editor";

  const sidebar = (
    <aside className="flex h-full w-[250px] flex-col bg-[#151a20] text-[#f6f1e8]">
      <div className="flex items-center justify-between border-b border-[#2a333d] px-4 py-4">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
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
        {items.map(item => {
          const active =
            location === item.href ||
            (item.href !== "/admin/articles/new" && location.startsWith(`${item.href}/`));
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
            {initials || "BMG"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{user.name ?? "Editor"}</p>
            <p className="truncate text-[0.62rem] text-[#a7b0ba]">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
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
