import { useRef, useState } from "react";
import { Copy, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AdminPageHeader, ConfirmDialog } from "@/components/admin/AdminUI";

export default function Media() {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; filename: string } | null>(null);
  const query = trpc.admin.media.list.useQuery();

  const upload = trpc.admin.media.upload.useMutation({
    onSuccess: () => {
      toast.success("Image uploaded and logged.");
      void utils.admin.media.list.invalidate();
      if (fileRef.current) fileRef.current.value = "";
      setUploading(false);
    },
    onError: error => {
      toast.error(error.message);
      setUploading(false);
    },
  });
  const remove = trpc.admin.media.delete.useMutation({
    onSuccess: () => {
      toast.success("Media record deleted and logged.");
      setDeleteTarget(null);
      void utils.admin.media.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Images must be smaller than 5 MB.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? "").split(",")[1] ?? "";
      upload.mutate({
        filename: file.name,
        mime: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64: base64,
        alt: file.name,
      });
    };
    reader.onerror = () => {
      setUploading(false);
      toast.error("Could not read that file.");
    };
    reader.readAsDataURL(file);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Image URL copied.");
    } catch {
      window.prompt("Image URL", url);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Media"
        description="Uploaded images are stored in project storage. Only JPEG, PNG and WebP files under 5 MB are accepted."
        action={
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-ink px-4 text-xs font-extrabold text-paper">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload image"}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => onFile(event.target.files?.[0])} />
          </label>
        }
      />

      {query.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(index => <div key={index} className="skeleton aspect-video rounded-lg" />)}
        </div>
      )}
      {query.error && <p className="text-sm text-destructive">{query.error.message}</p>}
      {query.data && query.data.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-card/50 py-16 text-center">
          <ImagePlus className="h-9 w-9 text-brand" />
          <h2 className="font-display mt-3 text-2xl font-semibold">No media yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Upload the first cover image, then choose it from the story editor.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {query.data?.map(asset => (
          <div key={asset.id} className="group overflow-hidden rounded-lg border border-line bg-card">
            <div className="aspect-video overflow-hidden bg-muted">
              <img src={asset.url} alt={asset.alt ?? asset.filename} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            </div>
            <div className="p-3">
              <p className="truncate text-xs font-bold text-foreground">{asset.filename}</p>
              <p className="mt-0.5 text-[0.62rem] text-muted-foreground">{Math.round(asset.size / 1024)} KB · {asset.mime.replace("image/", "").toUpperCase()}</p>
              <div className="mt-2 flex gap-1">
                <button type="button" onClick={() => void copy(asset.url)} className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded border border-line text-[0.62rem] font-bold text-muted-foreground hover:border-brand hover:text-brand">
                  <Copy className="h-3 w-3" /> Copy URL
                </button>
                <button type="button" onClick={() => setDeleteTarget({ id: asset.id, filename: asset.filename })} className="inline-flex h-7 w-7 items-center justify-center rounded border border-line text-muted-foreground hover:border-destructive hover:text-destructive" aria-label={`Delete ${asset.filename}`}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Delete this media record?"
        description={`“${deleteTarget?.filename ?? ""}” will be removed from the library. Existing stories that already use the image may keep showing it from storage.`}
        pending={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id })}
      />
    </div>
  );
}
