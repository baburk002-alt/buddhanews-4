import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { AdminPageHeader } from "@/components/admin/AdminUI";

const FILTERS = [
  { key: "", label: "All actions" },
  { key: "article", label: "Stories" },
  { key: "media", label: "Media" },
  { key: "settings", label: "Settings" },
  { key: "message", label: "Messages" },
  { key: "auth", label: "Sign-in" },
  { key: "ai", label: "AI" },
];

function prettyMetadata(value: string | null): string {
  if (!value) return "—";
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, entry]) => `${key}: ${String(entry)}`)
      .join(" · ");
  } catch {
    return value;
  }
}

export default function Audit() {
  const { formatDate } = useI18n();
  const [action, setAction] = useState("");
  const query = trpc.admin.audit.list.useQuery({ limit: 200, action: action || undefined });

  return (
    <div>
      <AdminPageHeader
        title="Security audit log"
        description="Who changed what, when, and from where. Entries are written by the server and cannot be edited from the dashboard."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map(filter => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setAction(filter.key)}
            className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-bold transition-colors ${
              action === filter.key
                ? "border-ink bg-ink text-paper"
                : "border-line bg-card text-muted-foreground hover:border-brand"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-teal/30 bg-teal/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
        <p>
          Passwords and raw IP addresses are never stored in this log. Only a rotating, keyed
          fingerprint is kept server-side to investigate misuse; it is not shown here. Restrict
          access to this page to the owner and trusted administrators.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-card">
        {query.isLoading && <div className="space-y-2 p-4">{[0, 1, 2, 3].map(index => <div key={index} className="skeleton h-10 rounded" />)}</div>}
        {query.error && <p className="p-6 text-sm text-destructive">{query.error.message}</p>}
        {query.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/60 text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-extrabold">Time</th>
                  <th className="px-4 py-3 font-extrabold">Actor</th>
                  <th className="px-4 py-3 font-extrabold">Action</th>
                  <th className="px-4 py-3 font-extrabold">Entity</th>
                  <th className="px-4 py-3 font-extrabold">Details</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map(log => (
                  <tr key={log.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                      <span className="block text-[0.6rem]">{new Date(log.createdAt).toLocaleTimeString("en-GB")}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">{log.actorName ?? "system"}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[0.66rem] font-semibold text-foreground">{log.action}</code>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{log.entityType ?? "—"}{log.entityId ? ` #${log.entityId}` : ""}</td>
                    <td className="max-w-[320px] px-4 py-3 text-[0.66rem] text-muted-foreground">
                      {prettyMetadata(log.metadata)}
                    </td>
                  </tr>
                ))}
                {query.data.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No log entries match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
