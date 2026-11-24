import { useState, type FormEvent } from "react";
import { KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import {
  loginWithSecret,
  loginWithStaffEmail,
  requestStaffCode,
  resetStaffPassword,
} from "@/lib/adminAuth";

interface AdminLoginProps {
  onSuccess?: () => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [mode, setMode] = useState<"email" | "secret" | "reset">("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter your official email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginWithStaffEmail(email.trim(), password.trim());
      if (!res.ok) {
        setError(res.error || "Invalid email or password.");
        if (res.needsVerification) {
          setMode("reset");
        }
        return;
      }
      onSuccess?.();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSecretLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!password.trim()) {
      setError("Please enter your role secret.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginWithSecret(password.trim());
      if (!res.ok) {
        setError(res.error || "Invalid secret.");
        return;
      }
      onSuccess?.();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendCode() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Please enter your official email first.");
      return;
    }
    setSendingCode(true);
    try {
      const res = await requestStaffCode(email.trim());
      if (!res.ok) {
        setError(res.error || "Failed to send verification code.");
        return;
      }
      setInfo(res.message || "Verification code sent.");
    } catch {
      setError("Failed to send verification code.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !code.trim() || newPassword.trim().length < 8) {
      setError("Official email, 6-digit code, and a password of at least 8 characters are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetStaffPassword(email.trim(), code.trim(), newPassword.trim());
      if (!res.ok) {
        setError(res.error || "Failed to verify email or reset password.");
        return;
      }
      setInfo(res.message || "Email verified and new password saved. You can sign in now.");
      setPassword(newPassword.trim());
      setCode("");
      setNewPassword("");
      setMode("email");
    } catch {
      setError("Failed to verify email or reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="ltr" className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-left">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="kicker text-[0.68rem] uppercase tracking-[0.18em] text-brand">
            Buddha News CMS
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
            Admin Login
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sign in with your official email, verify or reset your password, or use a role secret.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-background p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode("email"); setError(null); setInfo(null); }}
            className={mode === "email" ? "rounded-md bg-ink py-2 text-paper" : "rounded-md py-2 text-muted-foreground hover:text-foreground"}
          >
            Email Login
          </button>
          <button
            type="button"
            onClick={() => { setMode("reset"); setError(null); setInfo(null); }}
            className={mode === "reset" ? "rounded-md bg-ink py-2 text-paper" : "rounded-md py-2 text-muted-foreground hover:text-foreground"}
          >
            Verify / Reset
          </button>
          <button
            type="button"
            onClick={() => { setMode("secret"); setError(null); setInfo(null); }}
            className={mode === "secret" ? "rounded-md bg-ink py-2 text-paper" : "rounded-md py-2 text-muted-foreground hover:text-foreground"}
          >
            Role Secret
          </button>
        </div>

        {mode === "email" && (
          <form onSubmit={handleEmailLogin} className="space-y-4 text-xs">
            <div>
              <label className="mb-1.5 block font-semibold text-foreground">Official Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@yourdomain.com"
                  className="w-full rounded-lg border border-line bg-background py-2.5 pl-10 pr-3 text-sm text-foreground focus:border-brand focus:outline-none"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-semibold text-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-line bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none"
                autoComplete="current-password"
              />
            </div>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">{error}</p>}
            {info && <p className="rounded-lg bg-teal/10 px-3 py-2 font-medium text-teal">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
            <div>
              <label className="mb-1.5 block font-semibold text-foreground">Official Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@yourdomain.com"
                  className="w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="shrink-0 rounded-lg border border-line bg-background px-3 py-2.5 font-bold text-foreground hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  {sendingCode ? "Sending..." : "Send Code"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-semibold text-foreground">6-Digit Verification Code</label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-lg border border-line bg-background py-2.5 pl-10 pr-3 text-sm text-foreground focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-semibold text-foreground">New Password (min 8 characters)</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-line bg-background py-2.5 pl-10 pr-3 text-sm text-foreground focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">{error}</p>}
            {info && <p className="rounded-lg bg-teal/10 px-3 py-2 font-medium text-teal">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Verify Email & Save Password"}
            </button>
          </form>
        )}

        {mode === "secret" && (
          <form onSubmit={handleSecretLogin} className="space-y-4 text-xs">
            <div>
              <label className="mb-1.5 block font-semibold text-foreground">
                Role Secret (Owner / Chief Editor / Reporter)
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-line bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none"
                autoFocus
              />
            </div>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
