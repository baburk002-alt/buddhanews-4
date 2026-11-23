import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Eye, FileText, Inbox, Newspaper, Plus, Users } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { LaunchChecklist } from "@/components/admin/LaunchChecklist";
import { AdminPageHeader, StatCard, StatusBadge } from "@/components/admin/AdminUI";

export default function Dashboard() {
  const { formatNumber, formatDate } = useI18n();
  const { isAdmin } = useAuth();
  const statsQuery = trpc.admin.stats.useQuery();
  const auditQuery = trpc.admin.audit.list.useQuery({ limit: 8 });

  if (statsQuery.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map(index => (
          <div key={index} className="skeleton h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (statsQuery.error || !statsQuery.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <p className="text-sm font-bold text-foreground">Dashboard unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{statsQuery.error?.message}</p>
      </div>
    );
  }

  const stats = statsQuery.data;
  const chartData = stats.viewsByDay.map(row => ({
    ...row,
    label: new Date(`${row.day}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
  }));

  return (
    <div>
      <AdminPageHeader
        title="The desk today"
        description="A live read on publishing, readership and the security record."
      />

      {isAdmin && <LaunchChecklist />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Published" value={formatNumber(stats.published)} icon={<Newspaper className="h-4 w-4" />} hint="Live stories" />
        <StatCard label="Drafts" value={formatNumber(stats.drafts)} icon={<FileText className="h-4 w-4" />} hint="Waiting for an editor" />
        <StatCard label="Total views" value={formatNumber(stats.totalViews)} icon={<Eye className="h-4 w-4" />} hint="Across all stories" />
        <StatCard label="Subscribers" value={formatNumber(stats.subscribers)} icon={<Users className="h-4 w-4" />} hint="BMG Brief" />
        <StatCard label="New messages" value={formatNumber(stats.newMessages)} icon={<Inbox className="h-4 w-4" />} hint="Unread inbox" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-lg border border-line bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Readership, last 7 days</h2>
              <p className="text-xs text-muted-foreground">Recorded article views by day.</p>
            </div>
            <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-wide text-brand">Live</span>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-line text-sm text-muted-foreground">
              Views will appear here once readers arrive.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E9A23B" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#E9A23B" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#E9A23B" strokeWidth={2.5} fill="url(#viewsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-foreground">Quick actions</h2>
          </div>
          <div className="grid gap-2">
            {[
              { href: "/admin/articles/new", label: "Write a new story", icon: Plus },
              { href: "/admin/media", label: "Upload cover art", icon: FileText },
              { href: "/admin/messages", label: "Open the inbox", icon: Inbox },
              { href: "/admin/audit", label: "Review the security log", icon: Eye },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 text-xs font-bold text-foreground transition-colors hover:border-brand hover:text-brand"
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-3.5 w-3.5" /> {item.label}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-brand/30 bg-brand/10 p-3 text-[0.7rem] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Security reminder.</strong> Every save, publish, upload
            and deletion is written to the audit log with the editor, IP address and time.
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-line bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-foreground">Most read</h2>
            <Link href="/admin/articles" className="text-xs font-bold text-teal hover:text-brand">All stories →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-extrabold">Story</th>
                  <th className="pb-2 font-extrabold">Section</th>
                  <th className="pb-2 text-right font-extrabold">Views</th>
                </tr>
              </thead>
              <tbody>
                {stats.topArticles.map(article => (
                  <tr key={article.id} className="border-t border-line">
                    <td className="py-3 pr-3">
                      <Link href={`/admin/articles/${article.id}`} className="font-semibold text-foreground hover:text-brand">
                        {article.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-xs capitalize text-muted-foreground">{article.category}</td>
                    <td className="py-3 text-right text-xs font-bold tabular-nums text-foreground">{formatNumber(article.views)}</td>
                  </tr>
                ))}
                {stats.topArticles.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No published stories yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-foreground">Recent activity</h2>
            <Link href="/admin/audit" className="text-xs font-bold text-teal hover:text-brand">Full log →</Link>
          </div>
          <ul className="divide-y divide-line">
            {auditQuery.data?.slice(0, 8).map(log => (
              <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">{log.action}</p>
                  <p className="mt-0.5 truncate text-[0.66rem] text-muted-foreground">
                    {log.actorName ?? "system"} · {log.entityType ?? "site"} {log.entityId ?? ""}
                  </p>
                </div>
                <time className="shrink-0 text-[0.62rem] text-muted-foreground">{formatDate(log.createdAt)}</time>
              </li>
            ))}
            {(!auditQuery.data || auditQuery.data.length === 0) && (
              <li className="py-6 text-center text-sm text-muted-foreground">No activity yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
