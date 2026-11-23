import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerLocaleRedirects, registerSeoRoutes, transformHtml } from "../seo";
import { seedNewsroom } from "../seed";
import { checkRateLimitAsync, closeRateLimitStore, ipKey } from "../rateLimit";
import { storageGetSignedUrl } from "../storage";
import {
  assertProductionConfig,
  getPublicSiteUrl,
  getTrustProxy,
  getTurnstileConfig,
  getTrustedHosts,
  isProduction,
} from "../config";
import {
  isPublicStorageKey,
  normalizeStorageKey,
  sanitizeLogValue,
} from "../security";
import { databaseHealthy, findMediaByStorageKey, pruneSessions } from "../db";
import { sdk } from "./sdk";
import { UPLOAD_PATH, uploadGuard } from "./uploadGuard";
import { registerNewsletterRoutes } from "../newsletterRoutes";
import { runBootLaunchChecks } from "../launchCheck";
import { startScheduler, type SchedulerHandle } from "../scheduler";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Hosts that may originate a state-changing request. */
function originAllowed(origin: string, req: Request): boolean {
  let originHost: string;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    originHost = parsed.host;
  } catch {
    return false;
  }

  const allowedHosts = new Set<string>(getTrustedHosts());
  const requestHost = String(
    req.headers["x-forwarded-host"] ?? req.headers.host ?? ""
  )
    .split(",")[0]
    ?.trim();
  if (requestHost) allowedHosts.add(requestHost);

  return allowedHosts.has(originHost);
}

function isUnsafe(req: Request): boolean {
  return UNSAFE_METHODS.has(req.method.toUpperCase());
}

/**
 * Builds the Express application without binding a port. Tests import this to
 * exercise the real middleware stack (CSP, CSRF, rate limits, SEO) in-process.
 */
export async function createApp() {
  // Fail fast on an unsafe production configuration instead of silently
  // emitting attacker-controlled canonical URLs.
  assertProductionConfig();

  const app = express();
  const server = createServer(app);

  app.set("trust proxy", getTrustProxy());
  app.disable("x-powered-by");
  app.disable("etag");

  const imageHosts = (process.env.CSP_IMAGE_HOSTS ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const frameAncestors = (process.env.FRAME_ANCESTORS ?? "'self'")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  // Cloudflare Turnstile is the only third-party script/frame the site may load,
  // and the CSP allows it only when the widget is actually configured.
  const turnstileOrigin = getTurnstileConfig().widgetEnabled ? ["https://challenges.cloudflare.com"] : [];
  app.use(
    helmet({
      // Framing is controlled by CSP frame-ancestors so previews can opt in.
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      contentSecurityPolicy: isProduction
        ? {
            useDefaults: false,
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              objectSrc: ["'none'"],
              scriptSrc: ["'self'", ...turnstileOrigin],
              // React and Tailwind emit inline style attributes; script
              // execution is still restricted to first-party bundles.
              styleSrc: ["'self'", "'unsafe-inline'"],
              fontSrc: ["'self'", "data:"],
              imgSrc: ["'self'", "data:", "blob:", ...imageHosts],
              mediaSrc: ["'self'", ...imageHosts],
              connectSrc: ["'self'", ...turnstileOrigin],
              frameSrc: ["'self'", "https://www.youtube-nocookie.com", ...turnstileOrigin],
              workerSrc: ["'self'", "blob:"],
              manifestSrc: ["'self'"],
              frameAncestors,
              upgradeInsecureRequests: [],
            },
          }
        : false,
      hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );
  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    next();
  });

  // ---------------------------------------------------------------------
  // Order matters. Everything that can reject a request cheaply (CSRF origin
  // check, per-IP rate limit, and for uploads authentication + role + quota)
  // runs BEFORE any request body is read or parsed.
  // ---------------------------------------------------------------------

  // CSRF: every state-changing API call must carry a trusted Origin (or a
  // Referer we can reduce to one). SameSite=Lax cookies are the second layer.
  app.use("/api", (req, res, next) => {
    if (!isUnsafe(req)) return next();
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    const referer = typeof req.headers.referer === "string" ? req.headers.referer : "";
    let candidate = origin;
    if (!candidate && referer) {
      try {
        candidate = new URL(referer).origin;
      } catch {
        candidate = "";
      }
    }
    if (!candidate || candidate === "null" || !originAllowed(candidate, req)) {
      res.status(403).json({ error: "Cross-site request blocked" });
      return;
    }
    next();
  });

  // Coarse protection for every API surface; sensitive procedures add tighter
  // per-user or per-IP limits inside the tRPC router. Uses the shared (Redis)
  // store when REDIS_URL is set so the limit holds across instances.
  app.use("/api", async (req, res, next) => {
    try {
      const result = await checkRateLimitAsync(`api:${ipKey(req)}`, 300, 60_000);
      if (!result.ok) {
        res
          .status(429)
          .set("Retry-After", String(result.retryAfterSeconds))
          .json({ error: "Too many requests. Please slow down." });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Media upload: authenticate, authorise and rate-limit first; only then
  // allow the 8 MB parser. Every other route keeps the small default limit.
  app.use(UPLOAD_PATH, uploadGuard, express.json({ limit: "8mb", strict: true }));
  app.use(express.json({ limit: "256kb", strict: true }));
  app.use(express.urlencoded({ limit: "64kb", extended: false, parameterLimit: 50 }));

  app.get("/api/health", async (_req, res) => {
    const dbOk = await databaseHealthy();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "up" : "down",
      time: new Date().toISOString(),
    });
  });

  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });

  registerOAuthRoutes(app);
  registerNewsletterRoutes(app);
  registerSeoRoutes(app);
  registerLocaleRedirects(app);

  // ---------------------------------------------------------------------
  // Managed storage. Public assets (published imagery) are served directly;
  // anything outside the public prefixes requires a signed-in session and
  // ownership (or an administrator role).
  // ---------------------------------------------------------------------
  app.get("/manus-storage/*", async (req, res) => {
    const raw = req.path.replace(/^\/manus-storage\//, "");
    const key = normalizeStorageKey(raw);
    if (!key) {
      res.status(400).type("text/plain").send("Invalid storage key");
      return;
    }

    const limit = await checkRateLimitAsync(`storage:${ipKey(req)}`, 240, 60_000);
    if (!limit.ok) {
      res.status(429).type("text/plain").send("Too many asset requests");
      return;
    }

    const isPublic = isPublicStorageKey(key);
    if (!isPublic) {
      let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        user = null;
      }
      if (!user) {
        res.status(401).type("text/plain").send("Authentication required");
        return;
      }
      const asset = await findMediaByStorageKey(key).catch(() => null);
      if (!asset) {
        res.status(404).type("text/plain").send("Asset not found");
        return;
      }
      // Every key outside the published prefixes is private, regardless of a
      // media row's default visibility. Only the uploader or an administrator
      // may obtain a signed URL for it.
      if (asset.uploadedBy !== user.id && user.role !== "admin") {
        res.status(403).type("text/plain").send("Not allowed");
        return;
      }
    }

    try {
      const url = await storageGetSignedUrl(key);
      res
        .set(
          "Cache-Control",
          isPublic ? "public, max-age=300, stale-while-revalidate=60" : "private, no-store"
        )
        .redirect(302, url);
    } catch (error) {
      console.error("[Storage] Could not sign asset", sanitizeLogValue(key, 80), error);
      res.status(404).type("text/plain").send("Asset not found");
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // ---------------------------------------------------------------------
  // Pages: Vite in development, the built SPA in production. Metadata and
  // HTTP status codes are decided by `transformHtml`, so a missing page is a
  // real 404 rather than a 200 with a "not found" screen.
  // ---------------------------------------------------------------------
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server, transformHtml);
  } else {
    serveStatic(app, transformHtml);
  }

  // Final error handler: never leak stack traces to visitors.
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "unknown error";
    const details = error as { status?: number; statusCode?: number; type?: string };
    const status = details.status ?? details.statusCode;
    if (status === 413 || details.type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large" });
      return;
    }
    if (status === 400 && details.type === "entity.parse.failed") {
      res.status(400).json({ error: "Malformed JSON body" });
      return;
    }
    console.error("[Server] Unhandled error:", sanitizeLogValue(message, 300));
    if (req.path.startsWith("/api")) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.status(500).type("text/plain").send("Something went wrong");
  });

  return { app, server };
}

async function startServer() {
  let scheduler: SchedulerHandle | null = null;
  const { server } = await createApp();
  // Report (and with ENFORCE_LAUNCH_CHECKS=true, refuse to run with) demo
  // settings, missing mail delivery and similar pre-launch problems.
  await runBootLaunchChecks();

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");

  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Buddha News listening on port ${port}`);
    if (process.env.SEED_ON_START === "true") {
      seedNewsroom()
        .then(result => {
          if (result.seeded) console.log(`[Seed] Newsroom ready with ${result.count} stories`);
        })
        .catch(error => console.error("[Seed] Failed:", error));
    }
    void pruneSessions().catch(() => undefined);
    scheduler = startScheduler();
  });

  // Graceful shutdown: stop accepting connections, let in-flight requests
  // finish, then exit. Docker sends SIGTERM on deploy/stop.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] ${signal} received — shutting down`);
    scheduler?.stop();
    void closeRateLimitStore().catch(() => undefined);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Tests import createApp directly; the process only starts a listener when run
// as the server entry point.
if (process.env.NODE_ENV !== "test") {
  startServer().catch(error => {
    console.error("[Server] Failed to start:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
