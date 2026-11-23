import type { User } from "../drizzle/schema";
import { getAdminEmails, getEditorEmails, getOwnerOpenId, requireVerifiedEmail } from "./config";

export type Role = "user" | "editor" | "admin";

export type EffectiveAccess = {
  role: Role;
  /** True when the stored role had to be rewritten during this request. */
  changed: boolean;
  previousRole: Role;
  reason:
    | "owner"
    | "admin-allowlist"
    | "editor-allowlist"
    | "manual-grant"
    | "unverified-email"
    | "default";
};

const RANK: Record<Role, number> = { user: 0, editor: 1, admin: 2 };

export function atLeast(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

/**
 * Resolve the role an account is *currently* entitled to.
 *
 * Configuration is authoritative. A database role only survives while the
 * account is still listed in ADMIN_EMAILS/EDITOR_EMAILS or an owner granted it
 * explicitly (`roleSource = 'manual'`). Removing someone from ADMIN_EMAILS
 * therefore revokes access on their next request — no waiting for a token to
 * expire, no "role left behind in the database" window.
 */
export function resolveAccess(
  user: Pick<User, "openId" | "email" | "role" | "roleSource"> & { emailVerified?: boolean | null }
): EffectiveAccess {
  const previousRole = (user.role ?? "user") as Role;
  const email = (user.email ?? "").toLowerCase();
  const ownerOpenId = getOwnerOpenId();

  if (ownerOpenId && user.openId === ownerOpenId) {
    return { role: "admin", changed: previousRole !== "admin", previousRole, reason: "owner" };
  }
  // An allow-list match is only as trustworthy as the provider's claim that the
  // address belongs to the account holder. `emailVerified === false` always
  // blocks the match; with REQUIRE_VERIFIED_EMAIL=true anything other than an
  // explicit `true` blocks it (use when the provider reports verification).
  const emailTrusted =
    user.emailVerified === false ? false : requireVerifiedEmail() ? user.emailVerified === true : true;
  const listedAsAdmin = Boolean(email) && getAdminEmails().includes(email);
  const listedAsEditor = Boolean(email) && getEditorEmails().includes(email);
  if ((listedAsAdmin || listedAsEditor) && !emailTrusted) {
    // Fall through to manual grants / default instead of honouring the list.
    return user.roleSource === "manual" && (previousRole === "admin" || previousRole === "editor")
      ? { role: previousRole, changed: false, previousRole, reason: "manual-grant" }
      : {
          role: "user",
          changed: previousRole !== "user",
          previousRole,
          reason: "unverified-email",
        };
  }
  if (listedAsAdmin) {
    return {
      role: "admin",
      changed: previousRole !== "admin",
      previousRole,
      reason: "admin-allowlist",
    };
  }
  if (listedAsEditor) {
    return {
      role: "editor",
      changed: previousRole !== "editor",
      previousRole,
      reason: "editor-allowlist",
    };
  }
  if (user.roleSource === "manual" && (previousRole === "admin" || previousRole === "editor")) {
    return { role: previousRole, changed: false, previousRole, reason: "manual-grant" };
  }
  return {
    role: "user",
    changed: previousRole !== "user",
    previousRole,
    reason: "default",
  };
}

/** Editors may draft and edit; only administrators may publish or delete. */
export function canPublish(role: Role): boolean {
  return role === "admin";
}

export function canDelete(role: Role): boolean {
  return role === "admin";
}

export function canManageNewsroom(role: Role): boolean {
  return atLeast(role, "editor");
}

export function canManageSettings(role: Role): boolean {
  return role === "admin";
}

/** Only the configured project owner may change other people's roles. */
export function isOwner(user: Pick<User, "openId"> | null | undefined): boolean {
  const ownerOpenId = getOwnerOpenId();
  return Boolean(ownerOpenId && user && user.openId === ownerOpenId);
}
