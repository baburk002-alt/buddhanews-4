import { COOKIE_NAME, OAUTH_STATE_COOKIE, decodeOAuthState, encodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { extractEmailVerified } from "../emailVerification";
import { checkRateLimitAsync, ipKey, userAgent } from "../rateLimit";
import { randomToken, safeEqual, sanitizeLogValue } from "../security";
import { getPublicSiteUrl } from "../config";
import { ENV } from "./env";
import { getClearCookieOptions, getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/** Only same-site paths may be used as a post-login destination. */
function safeReturnPath(value: string | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value.slice(0, 300);
}

function requestOrigin(req: Request): string {
  const site = getPublicSiteUrl();
  if (site) return site;
  const host = String(req.headers["x-forwarded-host"] ?? req.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  return host ? `${req.protocol}://${host}` : "";
}

export function registerOAuthRoutes(app: Express) {
  /**
   * Begin login. The nonce lives in an HttpOnly, SameSite=Lax cookie that only
   * this origin can set; the callback refuses a state whose nonce does not
   * match it. This closes the login-CSRF gap that a purely client-side state
   * cookie left open and keeps the nonce out of reach of XSS.
   */
  app.get("/api/oauth/start", async (req: Request, res: Response) => {
    const portal = ENV.oAuthPortalUrl.replace(/\/+$/, "");
    const appId = ENV.appId;
    const origin = requestOrigin(req);
    if (!portal || !appId || !origin) {
      res.status(503).json({
        error:
          "Login is not configured. Set MANUS_OAUTH_PORTAL_URL, MANUS_PROJECT_ID and PUBLIC_SITE_URL.",
      });
      return;
    }
    const limit = await checkRateLimitAsync(`oauth-start:${ipKey(req)}`, 20, 60_000);
    if (!limit.ok) {
      res
        .status(429)
        .set("Retry-After", String(limit.retryAfterSeconds))
        .json({ error: "Too many sign-in attempts. Please wait a minute." });
      return;
    }

    const nonce = randomToken(24);
    const returnTo = safeReturnPath(getQueryParam(req, "returnTo"));
    const redirectUri = `${origin}/api/oauth/callback`;
    const state = encodeOAuthState({ redirectUri, nonce, returnTo });

    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      ...getSessionCookieOptions(req),
      maxAge: 10 * 60 * 1000,
    });

    const url = new URL(`${portal}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("responseType", "code");
    res.redirect(302, url.toString());
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const limit = await checkRateLimitAsync(`oauth:${ipKey(req)}`, 20, 60_000);
    if (!limit.ok) {
      res
        .status(429)
        .set("Retry-After", String(limit.retryAfterSeconds))
        .json({ error: "Too many sign-in attempts. Please wait a minute." });
      return;
    }

    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const decoded = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    const expectedRedirect = `${requestOrigin(req)}/api/oauth/callback`;
    if (
      !decoded.nonce ||
      !expectedNonce ||
      !safeEqual(decoded.nonce, expectedNonce) ||
      decoded.redirectUri !== expectedRedirect
    ) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, getClearCookieOptions(req));

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        emailVerified: extractEmailVerified(userInfo),
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      const signedInUser = await db.getUserByOpenId(userInfo.openId);
      if (!signedInUser) {
        res.status(500).json({ error: "Could not create the account" });
        return;
      }

      const session = await sdk.issueSession(signedInUser, req);

      try {
        await db.writeAuditLog({
          actorId: signedInUser.id,
          actorName: userInfo.name ?? userInfo.email ?? "Manus account",
          action: "auth.login",
          entityType: "user",
          entityId: signedInUser.id,
          ipHash: ipKey(req),
          userAgent: userAgent(req),
          metadata: { method: "manus_oauth", sessionId: session.sid },
        });
      } catch (auditError) {
        console.error("[Audit] Login entry failed", auditError);
      }

      res.cookie(SESSION_COOKIE_NAME_LOCAL, session.token, {
        ...getSessionCookieOptions(req),
        maxAge: session.maxAgeMs,
      });

      res.redirect(302, safeReturnPath(decoded.returnTo ?? getQueryParam(req, "returnTo")));
    } catch (error) {
      const reason = error instanceof Error ? sanitizeLogValue(error.message, 180) : "unknown error";
      console.error("[OAuth] Callback failed", reason);
      try {
        await db.writeAuditLog({
          actorName: "unknown",
          action: "auth.login_failed",
          entityType: "user",
          ipHash: ipKey(req),
          userAgent: userAgent(req),
          metadata: { method: "manus_oauth", reason },
        });
      } catch {
        // Do not hide the original OAuth failure behind an audit error.
      }
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  /** Invalidate the current session server-side, then clear the cookie. */
  app.post("/api/oauth/logout", async (req: Request, res: Response) => {
    try {
      const cookies = parseCookieHeader(req.headers.cookie ?? "");
      const token = cookies[SESSION_COOKIE_NAME_LOCAL];
      const session = await sdk.verifySession(token);
      if (session) await db.revokeSession(session.sid);
    } catch {
      // Logging out must always succeed from the client's point of view.
    }
    res.clearCookie(SESSION_COOKIE_NAME_LOCAL, getClearCookieOptions(req));
    res.status(204).end();
  });
}

/** Kept local to avoid a circular import with the SDK module. */
const SESSION_COOKIE_NAME_LOCAL = COOKIE_NAME;
