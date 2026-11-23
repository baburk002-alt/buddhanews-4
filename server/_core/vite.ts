import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import type { HtmlTransform } from "../seo";

/**
 * Turn a transform result into a response.
 *
 * A 301/302 result carries the destination path in `html` (see
 * `server/seo.ts`), which keeps slug redirects and locale redirects in one
 * place instead of duplicating routing rules per server mode.
 */
function sendTransformed(res: Response, result: { html: string; status: number }, fallbackStatus: number) {
  if (result.status === 301 || result.status === 302) {
    res.redirect(result.status, result.html);
    return;
  }
  const status = result.status === 404 ? 404 : result.status === 503 ? 503 : fallbackStatus === 404 ? 404 : result.status;
  res
    .status(status)
    .set({
      "Content-Type": "text/html; charset=utf-8",
      // HTML depends on the route, the locale and live article data.
      "Cache-Control": "no-store",
    })
    .end(result.html);
}

export async function setupVite(app: Express, server: Server, transform?: HtmlTransform) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };
  // vite.config.ts exports a function so build-only and serve-only plugins can
  // differ (jsxLocPlugin is development-only). Resolve it for the dev server.
  const resolvedConfig =
    typeof viteConfig === "function"
      ? await viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false })
      : await viteConfig;
  const vite = await createViteServer({
    ...resolvedConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  const renderPage = async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try {
      const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      if (!transform) {
        res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(page);
        return;
      }
      sendTransformed(res, await transform(page, req), 200);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  };

  // Page navigations must be transformed before Vite's own HTML fallback can
  // answer them. Otherwise every route would ship the generic <title>.
  app.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const pathname = req.path;
    const lastSegment = pathname.split("/").pop() ?? "";
    const isPage =
      !pathname.startsWith("/@") &&
      !pathname.startsWith("/__") &&
      !pathname.startsWith("/src/") &&
      !pathname.startsWith("/node_modules/") &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/manus-storage/") &&
      !lastSegment.includes(".");
    if (!isPage) return next();
    await renderPage(req, res, next);
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    await renderPage(req, res, next);
  });
}

export function serveStatic(app: Express, transform?: HtmlTransform) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  const builtIndex = path.resolve(distPath, "index.html");
  // In tests (and on a misconfigured first deploy) the build may not exist yet.
  // Fall back to the source template so SEO metadata and status codes can still
  // be exercised; production always serves the built file.
  const templatePath = fs.existsSync(builtIndex)
    ? builtIndex
    : path.resolve(import.meta.dirname, "../..", "client", "index.html");
  if (!fs.existsSync(builtIndex)) {
    console.warn(`[Static] Build not found at ${distPath}; serving the source template.`);
  }

  // Hashed assets can be cached forever; HTML never is.
  app.use(
    express.static(distPath, {
      index: false,
      etag: true,
      maxAge: "1y",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
      },
    })
  );

  const sendIndex = async (req: Request, res: Response) => {
    const template = await fs.promises.readFile(templatePath, "utf-8");
    if (!transform) {
      res.status(200).type("html").send(template);
      return;
    }
    sendTransformed(res, await transform(template, req), 200);
  };

  // The app's not-found page keeps a real 404 status for crawlers.
  app.get("/404", async (req, res, next) => {
    try {
      if (!transform) {
        res.status(404).type("html").send(await fs.promises.readFile(templatePath, "utf-8"));
        return;
      }
      const result = await transform(await fs.promises.readFile(templatePath, "utf-8"), req);
      sendTransformed(res, { ...result, status: 404 }, 404);
    } catch (error) {
      next(error);
    }
  });

  app.use("*", async (req, res, next) => {
    try {
      await sendIndex(req, res);
    } catch (error) {
      next(error);
    }
  });
}
