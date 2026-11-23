import { Mail, MailCheck, Reply } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { AdminPageHeader, StatusBadge } from "@/components/admin/AdminUI";

export default function Messages() {
  const { formatDate } = useI18n();
  const utils = trpc.useUtils();
  const query = trpc.admin.messages.list.useQuery();
  const update = trpc.admin.messages.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Message status updated and logged.");
      void utils.admin.messages.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div>
      <AdminPageHeader
        title="Inbox"
        description="Messages from the public contact form. The form is rate-limited; sensitive tips belong on the secure tip line."
      />
      {query.isLoading && <div className="space-y-3">{[0, 1, 2].map(index => <div key={index} className="skeleton h-32 rounded-lg" />)}</div>}
      {query.error && <p className="text-sm text-destructive">{query.error.message}</p>}
      {query.data && query.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-card/50 py-16 text-center">
          <Mail className="mx-auto h-9 w-9 text-brand" />
          <h2 className="font-display mt-3 text-2xl font-semibold">The inbox is clear</h2>
          <p className="mt-1 text-sm text-muted-foreground">New contact-form messages will appear here.</p>
        </div>
      )}
      <div className="grid gap-4">
        {query.data?.map(message => (
          <article key={message.id} className="rounded-lg border border-line bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={message.status} />
                  <span className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">{message.locale}</span>
                </div>
                <h2 className="font-display mt-2 text-lg font-semibold text-foreground">{message.subject}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {message.name} · <a href={`mailto:${message.email}`} className="text-teal hover:text-brand">{message.email}</a> · {formatDate(message.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject)}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-line px-2.5 text-[0.66rem] font-bold text-foreground hover:border-brand"
                >
                  <Reply className="h-3 w-3" /> Reply
                </a>
                {message.status === "new" && (
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: message.id, status: "read" })}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-line px-2.5 text-[0.66rem] font-bold text-foreground hover:border-brand"
                  >
                    <MailCheck className="h-3 w-3" /> Mark read
                  </button>
                )}
                {message.status !== "replied" && (
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: message.id, status: "replied" })}
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-ink px-2.5 text-[0.66rem] font-bold text-paper"
                  >
                    Mark replied
                  </button>
                )}
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap border-t border-line pt-4 text-sm leading-relaxed text-foreground/90">{message.message}</p>

          </article>
        ))}
      </div>
    </div>
  );
}
