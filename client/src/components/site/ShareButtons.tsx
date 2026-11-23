import { useState } from "react";
import { Check, Facebook, Link2, Mail, MessageCircle, Printer, Send, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";

export function ShareButtons({ title, path }: { title: string; path: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("copied"));
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt(t("copyLink"), url);
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // dismissed
      }
    } else {
      void copy();
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const iconClass = "inline-flex h-11 w-11 items-center justify-center rounded-md border border-line bg-card text-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("share")}>
      <button
        type="button"
        onClick={nativeShare}
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-bold text-paper transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("share")}
      </button>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        aria-label={t("copyLink")}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-teal" aria-hidden="true" /> : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? t("copied") : t("copyLink")}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer noopener"
        className={iconClass}
        aria-label={`${t("shareOn")} X`}
      >
        <Twitter className="h-4 w-4" aria-hidden="true" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noreferrer noopener"
        className={iconClass}
        aria-label={`${t("shareOn")} Facebook`}
      >
        <Facebook className="h-4 w-4" aria-hidden="true" />
      </a>
      <a
        href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noreferrer noopener"
        className={iconClass}
        aria-label={`${t("shareOn")} WhatsApp`}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
      </a>
      <a
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noreferrer noopener"
        className={iconClass}
        aria-label={`${t("shareOn")} Telegram`}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </a>
      <a
        href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
        className={iconClass}
        aria-label={`${t("shareOn")} Email`}
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className={iconClass}
        aria-label={t("print")}
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
