import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { LotusMark } from "@/components/site/Logo";
import { getAdminToken, loginWithSecret } from "@/lib/adminAuth";

export default function AdminLogin() {
const [, navigate] = useLocation();
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

usePageMeta({
title: "Newsroom login — Buddha News",
description: "Protected Buddha News editorial access.",
noindex: true,
});

useEffect(() => {
if (getAdminToken()) {
  navigate("/admin/articles", { replace: true });
}
}, [navigate]);

async function onSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();
setError(null);
if (!password.trim()) {
  setError("مهرباني وکړئ اډمین پاسورډ ولیکئ.");
  return;
}

setLoading(true);
try {
  const result = await loginWithSecret(password.trim());
  if (!result.ok) {
    setError(result.error || "پاسورډ سم نه دی.");
    return;
  }
  navigate("/admin/articles", { replace: true });
} catch {
  setError("د سرور سره په اړیکه کې ستونزه راغله.");
} finally {
  setLoading(false);
}
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
        Manage stories directly with Cloudflare D1. Add new reporting, edit existing articles,
        or remove outdated stories in one place.
      </p>
      <div className="mt-8 grid gap-3">
        {[
          { icon: KeyRound, text: "Protected by your Cloudflare Worker ADMIN_SECRET" },
          { icon: ShieldCheck, text: "Stored directly in Cloudflare D1 database" },
        ].map(item => (
          <div key={item.text} className="flex items-center gap-3 text-sm text-[#f6f1e8]/80">
            <item.icon className="h-4 w-4 text-brand" /> {item.text}
          </div>
        ))}
      </div>
    </div>
    <p className="relative text-[0.66rem] text-[#a7b0ba]">
      Authorized editor access only.
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
        Sign in to manage stories.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Enter the <strong className="text-foreground">ADMIN_SECRET</strong> password you set in Wrangler
        to add, edit, or delete articles.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="grid gap-1.5 text-xs font-bold text-foreground">
          Admin Password (ADMIN_SECRET)
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Enter your admin password"
            className="h-11 rounded-md border border-line bg-background px-3 text-sm font-normal text-foreground focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>

        {error && (
          <p className="text-xs font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-extrabold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <p className="mt-6 text-center text-[0.66rem] text-muted-foreground">
        Public reader? <a href="/en/" className="font-bold text-teal hover:text-brand">Return to Buddha News</a>
      </p>
    </div>
  </section>
</div>
);
}
