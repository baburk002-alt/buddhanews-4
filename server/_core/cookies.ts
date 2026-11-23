import type { CookieOptions, Request } from "express";
import { isProduction } from "../config";

/**
 * Session cookie policy.
 *
 * - HttpOnly: no script (and therefore no XSS payload) can read it.
 * - Secure whenever the request is HTTPS (always in production).
 * - SameSite=Lax: the cookie is not attached to cross-site POSTs, which is the
 *   primary CSRF defence in addition to the Origin check in the API layer.
 *   A deployment that must run inside a third-party iframe can opt into
 *   SameSite=None with ALLOW_CROSS_SITE_COOKIES=true; the cookie stays Secure
 *   and HttpOnly and Origin validation still applies.
 * - Host-only (no Domain) and Path=/ so sibling subdomains cannot read it.
 */
export function getSessionCookieOptions(req: Request): CookieOptions {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    ?.trim();
  const secure =
    isProduction ||
    req.secure ||
    req.protocol === "https" ||
    forwardedProto === "https" ||
    process.env.COOKIE_SECURE === "true";
  const crossSite = process.env.ALLOW_CROSS_SITE_COOKIES === "true";
  return {
    httpOnly: true,
    path: "/",
    sameSite: crossSite ? "none" : "lax",
    secure: crossSite ? true : secure,
  };
}

/** Attributes used when clearing a cookie must match those used to set it. */
export function getClearCookieOptions(req: Request): CookieOptions {
  const { httpOnly: _httpOnly, ...rest } = getSessionCookieOptions(req);
  // An explicit expired maxAge makes the deletion deterministic even for
  // clients that ignore the Expires attribute set by res.clearCookie().
  return { ...rest, maxAge: -1 };
}
