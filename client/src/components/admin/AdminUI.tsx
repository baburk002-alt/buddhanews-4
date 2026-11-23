import { useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <span className="text-brand">{icon}</span>
      </div>
      <p className="font-display mt-3 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-teal/10 text-teal border-teal/30",
    draft: "bg-brand/10 text-brand border-brand/30",
    archived: "bg-muted text-muted-foreground border-line",
    new: "bg-destructive/10 text-destructive border-destructive/30",
    read: "bg-brand/10 text-brand border-brand/30",
    replied: "bg-teal/10 text-teal border-teal/30",
    subscribed: "bg-teal/10 text-teal border-teal/30",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide",
        styles[status] ?? styles.archived
      )}
    >
      {status}
    </span>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" /> {title}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </DialogDescription>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-line px-4 text-xs font-bold text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-4 text-xs font-extrabold text-destructive-foreground disabled:opacity-60"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
