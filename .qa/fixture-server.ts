// QA ONLY: serves the supplied fictional seed content in memory. No database or mutations.
import express from "express";
import { initTRPC, TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { z } from "zod";
import { createServer as createViteServer } from "vite";
import { SEED } from "../server/seed";

const t = initTRPC.create({ transformer: superjson });
const items = SEED.map((item, index) => ({
  id: index + 1,
  slug: item.slug,
  status: "published" as const,
  category: item.category,
  subcategory: item.subcategory ?? null,
  coverImage: null,
  coverAlt: "",
  authorName: "BMG News Desk",
  featured: !!item.featured,
  breaking: !!item.breaking,
  readMinutes: item.readMinutes,
  tags: item.tags,
  publishedAt: new Date(Date.now() - item.daysAgo * 86400000).toISOString(),
  updatedAt: null,
  views: 1200 - index * 47,
  isDemo: true,
  translations: (["en", "ps", "fa"] as const).map(locale => ({
    locale, slug: item.slug, title: item[locale].title, summary: item[locale].summary,
    content: item[locale].content, seoTitle: null, seoDescription: null, aiSummary: null, aiSummaryAt: null,
  })),
}));
const router = t.router({
  settings: t.router({ public: t.procedure.query(() => ({ siteName: "Buddha News", contactEmail: "", liveStreamUrl: "", tipSignal: "", announcement: "", ogImage: "", youtubeUrl: "", twitterUrl: "", facebookUrl: "" })) }),
  articles: t.router({
    list: t.procedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const request = ctx as { referer: string };
      if (request.referer.includes("qa=error")) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "QA fixture error" });
      if (request.referer.includes("qa=loading")) await new Promise(resolve => setTimeout(resolve, 10000));
      if (request.referer.includes("qa=empty")) return [];
      let result = items;
      if (input?.category) result = result.filter(item => item.category === input.category);
      if (input?.search) result = result.filter(item => item.translations.some(translation => translation.title.toLowerCase().includes(String(input.search).toLowerCase())));
      return result.slice(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 24));
    }),
    mostRead: t.procedure.query(() => items.slice(0, 5)),
    get: t.procedure.input(z.any()).query(({ input }) => ({ article: items.find(item => item.slug === input.slug) ?? items[0], related: items.slice(1, 4) })),
  }),
});
const app = express();
app.get("/__qa/axe.min.js", (_req, res) => res.sendFile("/home/ubuntu/buddhanews/.qa/axe.min.js"));
app.use("/api/trpc", createExpressMiddleware({ router, createContext: ({ req }) => ({ referer: req.headers.referer ?? "" }) }));
const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
app.use(vite.middlewares);
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () => console.log("QA-only fixture preview ready on port", process.env.PORT || 3000));
