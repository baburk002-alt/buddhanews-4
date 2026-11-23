import { AXIOS_TIMEOUT_MS, COOKIE_NAME, decodeOAuthState } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { SESSION_IDLE_TTL_MS, SESSION_TTL_MS, isProduction } from "../config";
import { extractEmailVerified } from "../emailVerification";
import { ipKey, userAgent } from "../rateLimit";
import { newSessionId } from "../security";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Project id used to bind a session token to this deployment.
 *
 * MANUS_PROJECT_ID is optional in self-hosted installs, but the binding must
 * still be stable: an empty value would be rejected by verification and every
 * login would silently fail. The fallback is a constant, never a secret.
 */
function sessionAppId(): string {
  return ENV.appId || "buddhanews";
}

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  sid: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: MANUS_OAUTH_API_URL is not configured! Set MANUS_OAUTH_API_URL environment variable."
      );
    }
  }

  private decodeState(state: string): string {
    return decodeOAuthState(state).redirectUri;
  }

  async getTokenByCode(code: string, state: string): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };
    const { data } = await this.client.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, payload);
    return data;
  }

  async getUserInfoByToken(token: ExchangeTokenResponse): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(GET_USER_INFO_PATH, {
      accessToken: token.accessToken,
    });
    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({ baseURL: ENV.oAuthServerUrl, timeout: AXIOS_TIMEOUT_MS });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE")) {
      return "microsoft";
    }
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  async exchangeCodeForToken(code: string, state: string): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return { ...(data as any), platform: loginMethod, loginMethod } as GetUserInfoResponse;
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("MANUS_JWT_SECRET is unavailable");
    return new TextEncoder().encode(secret);
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? SESSION_TTL_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      sid: payload.sid,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  /**
   * Issue a session: a signed token plus a server-side row that can be
   * revoked. The token alone is useless once the row is gone.
   */
  async issueSession(
    user: Pick<User, "id" | "openId" | "name">,
    req: Request
  ): Promise<{ token: string; sid: string; expiresAt: Date; maxAgeMs: number }> {
    const sid = newSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.createSession({
      id: sid,
      userId: user.id,
      openId: user.openId,
      ipHash: ipKey(req),
      userAgent: userAgent(req),
      expiresAt,
    });
    const token = await this.signSession({
      openId: user.openId,
      appId: sessionAppId(),
      name: user.name ?? "",
      sid,
    });
    return { token, sid, expiresAt, maxAgeMs: SESSION_TTL_MS };
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, sid } = payload as Record<string, unknown>;
      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        appId !== sessionAppId() ||
        typeof name !== "string" ||
        !isNonEmptyString(sid)
      ) {
        return null;
      }
      return { openId, appId, name, sid };
    } catch {
      return null;
    }
  }

  async getUserInfoWithJwt(jwtToken: string): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = { jwtToken, projectId: ENV.appId };
    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return { ...(data as any), platform: loginMethod, loginMethod } as GetUserInfoWithJwtResponse;
  }

  /**
   * Authenticate a request using the HttpOnly cookie only.
   *
   * The Bearer-token fallback that previously read a token mirrored into
   * sessionStorage has been removed: a token that JavaScript can read is a
   * token an XSS payload can steal, and it bypassed the session registry.
   */
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionToken = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("Invalid session cookie");

    const row = await db.getActiveSession(session.sid);
    if (!row || row.openId !== session.openId) {
      throw ForbiddenError("Session expired or revoked");
    }
    // The signed token and the server-side row must both still be valid. The
    // row is authoritative, so an administrator can shorten a session (or a
    // clock skew can never extend it) without waiting for the JWT to expire.
    if (row.expiresAt.getTime() <= Date.now()) {
      await db.revokeSession(row.id);
      throw ForbiddenError("Session expired");
    }

    // Idle timeout: a session untouched for hours must be re-authenticated.
    const idleDeadline = new Date(Date.now() - SESSION_IDLE_TTL_MS);
    if (row.lastSeenAt.getTime() < idleDeadline.getTime()) {
      await db.revokeSession(row.id);
      throw ForbiddenError("Session expired from inactivity");
    }

    let user = await db.getUserByOpenId(session.openId);
    if (!user) {
      // First request after a database reset: sync the profile once.
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          emailVerified: extractEmailVerified(userInfo),
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch {
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) throw ForbiddenError("User not found");

    // Throttle bookkeeping writes: at most one per five minutes per session.
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (row.lastSeenAt.getTime() < fiveMinutesAgo) {
      void db.touchSession(row.id, idleDeadline).catch(() => undefined);
      void db
        .upsertUser({ openId: user.openId, lastSignedIn: new Date() })
        .catch(() => undefined);
    }

    return { ...user, sessionId: row.id };
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }
}

export type AuthenticatedUser = User & { sessionId?: string };

export const sdk = new SDKServer();

/** Cookie name is exported for route handlers that must clear it. */
export const SESSION_COOKIE_NAME = COOKIE_NAME;

/** True when the deployment runs behind a trusted TLS terminator. */
export const SECURE_DEPLOYMENT = isProduction;
