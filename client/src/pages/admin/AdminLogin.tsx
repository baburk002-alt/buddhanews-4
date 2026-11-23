import { useEffect } from "react";
import { ArrowRight, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { LotusMark } from "@/components/site/Logo";

export default function AdminLogin() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  usePageMeta({ title: "Newsroom login — Buddha News", description: "Protected Buddha News editorial access.", noindex: true });

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "editor") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    );
  }

  if (user && user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="font-display mt-4 text-2xl font-semibold text-foreground">This account is not on the newsroom allowlist.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as <strong className="text-foreground">{user.name ?? user.email ?? "a reader"}</strong>.
            Ask the owner to grant the editor role, or sign in with an authorized account.
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

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#151a20] p-10 text-[#f6f1e8] lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(600px 420px at 20% 20%, rgba(233,162,59,0.18), transparent 65%), radial-gradient(500px 400px at 90% 90%, rgba(79,179,170,0.18), transparent 65%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <LotusMark inverted className="h-11 w-11" />
          <div>
            <p className="font-display text-2xl font-semibold leading-none">Buddha News</p>
            <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand">Buddha Media Group</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <p className="kicker mb-4 text-brand">The newsroom</p>
          <h1 className="font-display text-[clamp(2.4rem,4.5vw,4rem)] font-semibold leading-[1.05]">
            Publish carefully. Protect the record.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#a7b0ba]">
            A protected editorial desk for a trilingual newsroom: stories, translations, media,
            messages, subscribers and a complete security trail.
          </p>
          <div className="mt-8 grid gap-3">
            {[
              { icon: Lock, text: "Manus OAuth sign-in with owner-approved access" },
              { icon: ShieldCheck, text: "Every privileged action is audit-logged" },
              { icon: Sparkles, text: "AI drafting tools with a human editor in control" },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 text-sm text-[#f6f1e8]/80">
                <item.icon className="h-4 w-4 text-brand" /> {item.text}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[0.66rem] text-[#a7b0ba]">
          Authorized staff only. Access attempts are logged.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LotusMark className="h-10 w-10" />
            <p className="font-display text-xl font-semibold">Buddha News</p>
          </div>
          <p className="kicker mb-3 text-brand">Newsroom access</p>
          <h2 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-semibold text-foreground">
            Sign in to the editorial desk.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sign in with the Manus account the newsroom owner has approved. Access is limited to
            accounts listed in the owner's allowlist or explicitly granted a role; there is no
            “first visitor becomes admin” rule.
          </p>
          <button
            type="button"
            onClick={() => startLogin()}
            className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-extrabold text-paper transition-opacity hover:opacity-90"
          >
            Sign in with Manus <ArrowRight className="h-4 w-4" />
          </button>
          <div className="mt-6 rounded-lg border border-line bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Security note.</strong> Never share a password or a
            one-time code. Buddha News staff will not ask for either. If you believe an account is
            compromised, sign out and contact the owner immediately.
          </div>
          <p className="mt-6 text-center text-[0.66rem] text-muted-foreground">
            Public reader? <a href="/" className="font-bold text-teal hover:text-brand">Return to Buddha News</a>
          </p>
        </div>
      </section>
    </div>
  );
}
