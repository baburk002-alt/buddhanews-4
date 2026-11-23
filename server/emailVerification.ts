/**
 * Reads the "is this e-mail address verified?" claim from an identity
 * provider's user-info payload.
 *
 * The Manus OAuth user-info response does not currently include such a claim,
 * so this returns `null` ("unknown") for it. Providers that follow OIDC send
 * `email_verified`; some use camelCase. Strings "true"/"false" are accepted.
 * `null` means "the provider did not say" — it is never treated as verified.
 */
export function extractEmailVerified(info: unknown): boolean | null {
  if (!info || typeof info !== "object") return null;
  const record = info as Record<string, unknown>;
  for (const key of ["emailVerified", "email_verified", "isEmailVerified", "verifiedEmail"]) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }
  return null;
}
