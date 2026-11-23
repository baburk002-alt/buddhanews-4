import { TRPCError } from "@trpc/server";
import { getTurnstileConfig } from "./config";
import { sanitizeLogValue } from "./security";

/**
 * Server-side bot protection for the public forms.
 *
 * Browser-only checks are worthless against a script that talks to the API
 * directly, so both layers run on the server:
 *
 *  1. **Honeypot.** The forms render an input that humans never see. Any value
 *     in it means a bot filled every field. The request is acknowledged as if
 *     it succeeded (so the bot learns nothing) but nothing is stored or sent.
 *  2. **Cloudflare Turnstile.** When `TURNSTILE_SECRET_KEY` is set every
 *     submission must carry a token that Cloudflare confirms. Missing, expired,
 *     reused or unverifiable tokens are rejected. Fails closed.
 */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True when the hidden field contains anything but whitespace. */
export function honeypotTripped(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export type TurnstileResult = { ok: true } | { ok: false; reason: string; unavailable?: boolean };

export async function verifyTurnstileToken(
  token: string | null | undefined
): Promise<TurnstileResult> {
  const { enabled, secretKey } = getTurnstileConfig();
  if (!enabled) return { ok: true };
  if (!token || token.length > 2048) return { ok: false, reason: "missing-token" };
  try {
    const body = new URLSearchParams({ secret: secretKey, response: token });
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return { ok: false, reason: `siteverify-${response.status}`, unavailable: true };
    }
    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (result.success === true) return { ok: true };
    return {
      ok: false,
      reason: sanitizeLogValue((result["error-codes"] ?? ["rejected"]).join(","), 120),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? sanitizeLogValue(error.message, 120) : "unavailable",
      unavailable: true,
    };
  }
}

/** Throws a user-facing error unless Turnstile (when enabled) accepts the token. */
export async function requireHuman(token: string | null | undefined): Promise<void> {
  const result = await verifyTurnstileToken(token);
  if (result.ok) return;
  throw new TRPCError({
    code: result.unavailable ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST",
    message: result.unavailable
      ? "We could not verify that you are human right now. Please try again in a moment."
      : "Please complete the verification challenge and try again.",
  });
}
