import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget.
 *
 * Renders only when the server exposes a site key (TURNSTILE_SITE_KEY +
 * TURNSTILE_SECRET_KEY are both set); otherwise it renders nothing and the form
 * works exactly as before. The token is verified server-side — this component
 * only collects it.
 *
 * `resetSignal` lets the parent request a fresh challenge after a submission,
 * because a Turnstile token can be redeemed only once.
 */
type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      language?: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable"));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function turnstileSiteKey(): string {
  return window.__MANUS_CONFIG__?.turnstileSiteKey?.trim() ?? "";
}

export function TurnstileWidget({
  onToken,
  resetSignal = 0,
  language,
  className,
}: {
  onToken: (token: string | null) => void;
  resetSignal?: number;
  language?: string;
  className?: string;
}) {
  const siteKey = turnstileSiteKey();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callback = useRef(onToken);
  callback.current = onToken;

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(api => {
        if (cancelled || !container.current || widgetId.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          theme: "auto",
          language,
          callback: token => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, language]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      callback.current(null);
      window.turnstile.reset(widgetId.current);
    }
  }, [resetSignal]);

  if (!siteKey) return null;
  return <div ref={container} className={className} data-testid="turnstile" aria-label="Verification" />;
}
