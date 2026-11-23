import type { Locale } from "@shared/news";

export { COOKIE_NAME } from "@shared/const";

/** Locale preference cookie read by the server when redirecting `/`. */
export function rememberLocale(locale: Locale): void {
  try {
    document.cookie = `bn-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${
      window.location.protocol === "https:" ? "; Secure" : ""
    }`;
  } catch {
    // Storage can be unavailable in private modes; the URL still carries it.
  }
}

// Start the Manus OAuth login through the server, which mints the one-time
// state nonce and stores it in an HttpOnly cookie. Keeping this on the server
// means the nonce is never readable by scripts and the cookie policy is applied
// consistently (Secure in production and on HTTPS).
export const startLogin = (returnTo?: string) => {
  const safe = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "";
  window.location.href = `/api/oauth/start${safe ? `?returnTo=${encodeURIComponent(safe)}` : ""}`;
};
