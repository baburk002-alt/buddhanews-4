import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, SendHorizontal, Sparkles, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type ChatMessage = { role: "user" | "assistant"; text: string; error?: boolean };

export function AIAssistant() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [articleSlug, setArticleSlug] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ask = trpc.ai.ask.useMutation();

  function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    setMessages(previous => [...previous, { role: "user", text: trimmed }]);
    setInput("");
    ask.mutate(
      { question: trimmed, locale, articleSlug },
      {
        onSuccess: data => {
          setMessages(previous => [...previous, { role: "assistant", text: data.answer }]);
        },
        onError: error => {
          setMessages(previous => [
            ...previous,
            { role: "assistant", text: error.message || t("askError"), error: true },
          ]);
        },
      }
    );
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ question?: string; articleSlug?: string }>).detail;
      setOpen(true);
      if (detail?.articleSlug) setArticleSlug(detail.articleSlug);
      if (detail?.question) {
        setInput(detail.question);
        setPendingQuestion(detail.question);
      }
    };
    window.addEventListener("buddha:ai", handler);
    return () => window.removeEventListener("buddha:ai", handler);
  }, []);

  useEffect(() => {
    if (!open || !pendingQuestion) return;
    const question = pendingQuestion;
    setPendingQuestion(null);
    sendQuestion(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingQuestion]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, ask.isPending]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    sendQuestion(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-full border border-brand/30 bg-ink px-4 text-sm font-extrabold text-paper shadow-[0_18px_40px_-18px_rgba(21,26,32,0.8)] transition-transform hover:-translate-y-0.5 rtl:left-5 rtl:right-auto"
        aria-label={t("askAi")}
      >
        <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
        <span className="hidden sm:inline">{t("askAi")}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="left-auto right-0 top-0 h-[100dvh] w-full max-w-[460px] translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-r-0 p-0 sm:max-w-[460px]"
        >
          <DialogTitle className="sr-only">{t("askTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("askIntro")}</DialogDescription>
          <div className="flex h-full flex-col bg-card">
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="kicker mb-1 text-brand">BMG · AI</p>
                <h2 className="font-display text-xl font-semibold text-foreground">{t("askTitle")}</h2>
                <p className="mt-1 max-w-[300px] text-xs leading-relaxed text-muted-foreground">
                  {t("askIntro")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-muted-foreground hover:border-brand hover:text-brand"
                aria-label={t("close")}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
              {messages.length === 0 && (
                <div className="rounded-lg border border-line bg-background p-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("askIntro")}</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[92%] rounded-lg px-4 py-3 text-sm leading-relaxed",
                    message.role === "user"
                      ? "ms-auto bg-brand text-brand-foreground"
                      : message.error
                        ? "border border-destructive/40 bg-destructive/5 text-foreground"
                        : "border border-line bg-background text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              ))}
              {ask.isPending && (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-background px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  {t("thinking")}
                </div>
              )}
              {messages.length === 0 && (
                <div className="grid gap-2">
                  {(["suggestion1", "suggestion2", "suggestion3", "suggestion4"] as const).map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => sendQuestion(t(key))}
                      className="rounded-md border border-line bg-background px-3 py-2 text-start text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-line p-4">
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="sr-only">{t("askPlaceholder")}</span>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendQuestion(input);
                      }
                    }}
                    rows={2}
                    maxLength={600}
                    placeholder={t("askPlaceholder")}
                    className="w-full resize-none rounded-md border border-line bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand"
                  />
                </label>
                <button
                  type="submit"
                  disabled={ask.isPending || !input.trim()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  aria-label={t("send")}
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground">{t("aiDisclaimer")}</p>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
