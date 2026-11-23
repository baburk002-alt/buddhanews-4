import { useEffect, useRef, useState } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AdminPageHeader } from "@/components/admin/AdminUI";

const FIELDS: Array<{
  key: string;
  label: string;
  hint: string;
  type?: "text" | "email" | "url";
  textarea?: boolean;
}> = [
  { key: "siteName", label: "Site name", hint: "Shown in the masthead and metadata." },
  { key: "tagline", label: "Tagline", hint: "One line under the logo in shared links." },
  { key: "contactEmail", label: "Newsroom email", hint: "Public contact address and reply-to for the newsletter.", type: "email" },
  { key: "liveStreamUrl", label: "Live stream URL", hint: "YouTube or another live URL. Leave blank to link to the Videos section." },
  { key: "tipSignal", label: "Verified Signal number", hint: "Only publish a number the newsroom has verified. It appears on the tip line." },
  { key: "announcement", label: "Site announcement", hint: "Optional short notice. Leave blank to hide it.", textarea: true },
  { key: "youtubeUrl", label: "YouTube URL", hint: "Footer social link.", type: "url" },
  { key: "twitterUrl", label: "X / Twitter URL", hint: "Footer social link.", type: "url" },
  { key: "facebookUrl", label: "Facebook URL", hint: "Footer social link.", type: "url" },
  { key: "ogImage", label: "Default social image", hint: "Absolute or project image URL used when a story has no cover.", type: "url" },
];

export default function Settings() {
  const utils = trpc.useUtils();
  const query = trpc.admin.settings.get.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const loadedRef = useRef(false);

  useEffect(() => {
    if (query.data && !loadedRef.current) {
      loadedRef.current = true;
      setValues(query.data);
    }
  }, [query.data]);

  const save = trpc.admin.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved and logged.");
      void utils.admin.settings.get.invalidate();
      void utils.settings.public.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Public identity, contact channels and social links. Changes are audit-logged."
        action={
          <button
            type="button"
            onClick={() => save.mutate(values)}
            disabled={save.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-xs font-extrabold text-paper disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {save.isPending ? "Saving…" : "Save settings"}
          </button>
        }
      />

      {query.isLoading && <div className="skeleton h-80 rounded-lg" />}
      {query.error && <p className="text-sm text-destructive">{query.error.message}</p>}

      {query.data && (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <section className="rounded-lg border border-line bg-card p-5">
            <div className="grid gap-5">
              {FIELDS.map(field => (
                <label key={field.key} className="grid gap-1.5 text-xs font-extrabold text-foreground">
                  {field.label}
                  {field.textarea ? (
                    <textarea
                      value={values[field.key] ?? ""}
                      onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))}
                      rows={3}
                      maxLength={500}
                      className="rounded-md border border-line bg-background px-3 py-2 text-sm font-normal outline-none focus:border-brand"
                    />
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      value={values[field.key] ?? ""}
                      onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))}
                      maxLength={500}
                      className="h-11 rounded-md border border-line bg-background px-3 text-sm font-normal outline-none focus:border-brand"
                    />
                  )}
                  <span className="text-[0.65rem] font-normal leading-relaxed text-muted-foreground">{field.hint}</span>
                </label>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-brand/30 bg-brand/10 p-4">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <h2 className="font-display mt-2 text-lg font-semibold text-foreground">Security settings</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Never publish a Signal number or PGP key you have not verified offline. A fake secure
                channel is worse than no channel.
              </p>
            </div>
            <div className="rounded-lg border border-line bg-card p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-extrabold text-foreground">Deployment notes</p>
              <p className="mt-2">
                Set <code className="rounded bg-muted px-1">PUBLIC_SITE_URL</code> in the published
                environment to the final domain. Canonical links, Open Graph URLs and the sitemap use
                it; without it they stay relative.
              </p>
              <p className="mt-2">
                Add extra editors with <code className="rounded bg-muted px-1">ADMIN_EMAILS</code>{" "}
                (comma-separated) or by granting the editor role in the database.
              </p>
              <p className="mt-2">
                Image uploads go to project storage. Keep the 5 MB limit; it is enforced on the server.
              </p>
            </div>
            <div className="rounded-lg border border-line bg-card p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-extrabold text-foreground">Before launch</p>
              <p className="mt-2">Replace the sample stories, set the real contact email, add a verified Signal number, and publish at least one live stream URL.</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
