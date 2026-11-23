import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { resolveAccess, type EffectiveAccess } from "../access";
import * as db from "../db";
import { ipKey, userAgent } from "../rateLimit";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  access: EffectiveAccess | null;
  sessionId?: string;
};

/**
 * Resolve the session and the role the account is *currently* entitled to.
 *
 * Role resolution runs on every request rather than only at login, so removing
 * someone from ADMIN_EMAILS (or a manual grant) takes effect immediately:
 * their stored role is rewritten, their sessions are revoked, and the action
 * is written to the audit log.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let sessionId: string | undefined;

  try {
    const authenticated = await sdk.authenticateRequest(opts.req);
    sessionId = authenticated.sessionId;
    user = authenticated;
  } catch {
    user = null;
  }

  if (!user) {
    return { req: opts.req, res: opts.res, user: null, access: null };
  }

  const access = resolveAccess(user);

  if (access.changed) {
    try {
      await db.setUserRole(user.id, access.role, access.reason === "manual-grant" ? "manual" : "env");
      if (access.role === "user") {
        // Immediate revocation: every outstanding token for this account stops
        // working, not just the current one.
        await db.revokeUserSessions(user.id);
        await db.writeAuditLog({
          actorId: user.id,
          actorName: user.name ?? user.email ?? "unknown",
          action: "auth.role_revoked",
          entityType: "user",
          entityId: user.id,
          ipHash: ipKey(opts.req),
          userAgent: userAgent(opts.req),
          metadata: { from: access.previousRole, reason: access.reason },
        });
      } else if (access.previousRole !== access.role) {
        await db.writeAuditLog({
          actorId: user.id,
          actorName: user.name ?? user.email ?? "unknown",
          action: "auth.role_granted",
          entityType: "user",
          entityId: user.id,
          ipHash: ipKey(opts.req),
          userAgent: userAgent(opts.req),
          metadata: { to: access.role, reason: access.reason },
        });
      }
    } catch (error) {
      console.error("[Access] Could not apply role change", error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user: { ...user, role: access.role },
    access,
    sessionId,
  };
}
