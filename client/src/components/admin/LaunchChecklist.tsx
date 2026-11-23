import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Rocket } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const WHERE_LABEL: Record<string, string> = {
  "admin-settings": "Admin → Settings",
  environment: "Server environment",
  content: "Content",
  platform: "Hosting platform",
};

/**
 * Pre-launch checklist (admins only). Shows what still blocks or weakens a real
 * launch: demo contact address, placeholder social image, mail delivery,
 * Turnstile, demo stories, and so on. Data comes from `admin.launch.status`.
 */
export function LaunchChecklist() {
  const query = trpc.admin.launch.status.useQuery(undefined, { staleTime: 60_000 });
  const [open, setOpen] = useState(true);

  if (query.isLoading) return <div className="skeleton mb-6 h-20 rounded-lg" />;
  if (query.error || !query.data) return null;

  const report = query.data;
  const pending = report.items;

  if (pending.length === 0) {
    return (
      <section className="mb-6 flex items-center gap-3 rounded-lg border border-teal/30 bg-teal/5 p-4">
        <CheckCircle2 className="h-5 w-5 text-teal" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Launch checklist complete. Nothing left to fix.</p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "mb-6 rounded-lg border bg-card",
        report.blockers > 0 ? "border-destructive/40" : "border-brand/40"
      )}
      aria-label="Launch checklist"
    >
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-start"
      >
        <Rocket className={cn("h-5 w-5", report.blockers > 0 ? "text-destructive" : "text-brand")} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {report.blockers > 0 ? "Not ready to go live" : "Almost ready to go live"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {report.blockers} blocker{report.blockers === 1 ? "" : "s"} · {report.warnings} warning
            {report.warnings === 1 ? "" : "s"}. Demo values must be replaced before real readers arrive.
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {pending.map(item => (
            <li key={item.id} className="flex gap-3 p-4">
              <AlertTriangle
                className={cn("mt-0.5 h-4 w-4 shrink-0", item.severity === "blocker" ? "text-destructive" : "text-brand")}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  {item.title}
                  <span
                    className={cn(
                      "ms-2 rounded-full px-2 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-wide",
                      item.severity === "blocker" ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand"
                    )}
                  >
                    {item.severity}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
                  <span className="font-bold text-foreground">{WHERE_LABEL[item.where] ?? item.where}</span>
                  {item.keys.length > 0 && <> · {item.keys.join(", ")}</>}
                  {item.where === "admin-settings" && (
                    <>
                      {" "}
                      ·{" "}
                      <Link href="/admin/settings" className="font-bold text-brand underline-offset-2 hover:underline">
                        Open settings
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
