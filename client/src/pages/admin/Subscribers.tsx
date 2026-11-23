import { Download, Users } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { toCsv } from "@shared/csv";
import { AdminPageHeader, StatusBadge } from "@/components/admin/AdminUI";

export default function Subscribers() {
  const { formatDate } = useI18n();
  const query = trpc.admin.subscribers.list.useQuery();

  function exportCsv() {
    if (!query.data) return;
    const rows = [
      ["email", "locale", "status", "joined"],
      ...query.data.map(item => [item.email, item.locale, item.status, item.createdAt.toISOString()]),
    ];
    // Cells that start with = + - @ (or whitespace/control characters before
    // them) are prefixed with a quote so spreadsheets never run them as formulas.
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `buddha-news-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <AdminPageHeader
        title="Subscribers"
        description="Readers who asked for the BMG Brief. Export only for sending the newsletter; do not sell or share this list."
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={!query.data || query.data.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-xs font-extrabold text-paper disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-3 text-sm">
        <Users className="h-4 w-4 text-brand" />
        <span className="font-extrabold text-foreground">{query.data?.length ?? 0}</span>
        <span className="text-muted-foreground">subscribers</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-card">
        {query.isLoading && <div className="space-y-2 p-4">{[0, 1, 2, 3].map(index => <div key={index} className="skeleton h-10 rounded" />)}</div>}
        {query.error && <p className="p-6 text-sm text-destructive">{query.error.message}</p>}
        {query.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/60 text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-extrabold">Email</th>
                  <th className="px-4 py-3 font-extrabold">Language</th>
                  <th className="px-4 py-3 font-extrabold">Status</th>
                  <th className="px-4 py-3 font-extrabold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map(item => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3 font-semibold text-foreground">{item.email}</td>
                    <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{item.locale}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
                {query.data.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">No subscribers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
