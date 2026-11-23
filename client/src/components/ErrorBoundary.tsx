import { cn } from "@/lib/utils";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  /** React 19 attaches a digest to server-rendered errors; never a stack trace. */
  reference: string | null;
}

/**
 * Last line of defence in the browser. Stack traces, component names and
 * internal paths are never rendered: a reader sees a plain apology and two
 * recovery actions, while the details stay in the browser console for the
 * developer who is debugging.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, reference: null };
  }

  static getDerivedStateFromError(error: Error & { digest?: string }): State {
    return { hasError: true, reference: error.digest ?? null };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      console.error("[UI] Unhandled render error", error);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="font-display mt-4 text-2xl font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This page could not be displayed. Reloading usually fixes it; if it keeps happening,
            please try again in a few minutes.
          </p>
          {this.state.reference && (
            <p className="mt-3 font-mono text-[0.66rem] text-muted-foreground">
              Reference: {this.state.reference}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper",
                "hover:opacity-90"
              )}
            >
              <RotateCcw className="h-4 w-4" /> Reload page
            </button>
            <a
              href="/en/"
              className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-bold text-foreground"
            >
              <Home className="h-4 w-4" /> Front page
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
