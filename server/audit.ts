import type { TrpcContext } from "./_core/context";
import { writeAuditLog } from "./db";
import { ipKey, userAgent } from "./rateLimit";
import { sanitizeLogValue } from "./security";

/**
 * Append-only security log for privileged actions. The actor is always the
 * authenticated session user, never a value supplied by the browser, and the
 * network address is stored only as a keyed hash.
 */
export async function audit(
  ctx: TrpcContext,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await writeAuditLog({
      actorId: ctx.user?.id ?? null,
      actorName: ctx.user?.name ?? ctx.user?.email ?? "unknown",
      action: sanitizeLogValue(action, 80),
      entityType,
      entityId,
      ipHash: ipKey(ctx.req),
      userAgent: userAgent(ctx.req),
      metadata,
    });
  } catch (error) {
    // Logging must never break the business operation, but it must be visible.
    console.error("[Audit] Failed to append entry:", error);
  }
}

export async function auditAnonymous(
  ctx: TrpcContext,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await writeAuditLog({
      actorName: "anonymous",
      action: sanitizeLogValue(action, 80),
      entityType,
      entityId,
      ipHash: ipKey(ctx.req),
      userAgent: userAgent(ctx.req),
      metadata,
    });
  } catch (error) {
    console.error("[Audit] Failed to append entry:", error);
  }
}
