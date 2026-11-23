/**
 * Pre-parse guard for the media upload endpoint.
 *
 * The upload procedure receives a base64 JSON body of up to 8 MB. Parsing that
 * body is the expensive part, so everything that can reject a request cheaply
 * runs BEFORE `express.json` is allowed to read it:
 *
 *   1. per-IP rate limit
 *   2. declared Content-Length / Content-Type sanity checks
 *   3. session authentication (cookie → server-side session row)
 *   4. role check (editor or administrator)
 *   5. per-account rate limit
 *
 * Anonymous callers, wrong roles and floods therefore never cost an 8 MB parse.
 * The procedure keeps its own hourly quota and validation as a second layer.
 */
import type { NextFunction, Request, Response } from "express";
import { atLeast, resolveAccess } from "../access";
import { checkRateLimitAsync, ipKey } from "../rateLimit";
import { sdk } from "./sdk";

export const UPLOAD_PROCEDURE = "admin.media.upload";
export const UPLOAD_PATH = `/api/trpc/${UPLOAD_PROCEDURE}`;
/** Base64 inflates by ~4/3; leave headroom for the JSON envelope. */
export const UPLOAD_MAX_BODY_BYTES = 8 * 1024 * 1024;

/** tRPC-compatible error envelope (superjson), so the client shows a normal message. */
function reject(res: Response, status: number, code: string, message: string, retryAfter?: number) {
  if (retryAfter) res.set("Retry-After", String(retryAfter));
  res.status(status).json({ error: { json: { message, code: -32001, data: { code, httpStatus: status } } } });
}

export async function uploadGuard(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method !== "POST") return reject(res, 405, "METHOD_NOT_SUPPORTED", "Uploads must use POST.");

    const ipLimit = await checkRateLimitAsync(`upload-ip:${ipKey(req)}`, 60, 60_000);
    if (!ipLimit.ok) {
      return reject(res, 429, "TOO_MANY_REQUESTS", "Too many upload attempts.", ipLimit.retryAfterSeconds);
    }

    const declared = Number(req.headers["content-length"] ?? NaN);
    if (!Number.isFinite(declared) || declared <= 0) {
      return reject(res, 411, "BAD_REQUEST", "A Content-Length header is required.");
    }
    if (declared > UPLOAD_MAX_BODY_BYTES) {
      return reject(res, 413, "PAYLOAD_TOO_LARGE", "The file is too large.");
    }
    if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
      return reject(res, 415, "BAD_REQUEST", "Unsupported content type.");
    }

    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return reject(res, 401, "UNAUTHORIZED", "Please sign in to upload files.");
    }
    const access = resolveAccess(user);
    if (!atLeast(access.role, "editor")) {
      return reject(res, 403, "FORBIDDEN", "You do not have permission to upload files.");
    }

    const userLimit = await checkRateLimitAsync(`upload-user:${user.id}`, 40, 60_000);
    if (!userLimit.ok) {
      return reject(res, 429, "TOO_MANY_REQUESTS", "Too many uploads. Please wait a moment.", userLimit.retryAfterSeconds);
    }
    next();
  } catch (error) {
    next(error);
  }
}
