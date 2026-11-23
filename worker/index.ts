export interface Env {
DB: D1Database;
ASSETS: Fetcher;
ADMIN_SECRET?: string;
}

const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function isAuthorized(request: Request, env: Env): boolean {
const secret = (env.ADMIN_SECRET || "").trim();
if (!secret) {
return false;
}
const authHeader = request.headers.get("Authorization") || "";
const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
return token === secret;
}

function slugify(input: string): string {
return input
.toLowerCase()
.trim()
.replace(/[^a-z0-9\s-]/g, "")
.replace(/\s+/g, "-")
.replace(/-+/g, "-")
.replace(/^-|-$/g, "") || `story-${Date.now()}`;
}

export default {
async fetch(request: Request, env: Env): Promise<Response> {
const url = new URL(request.url);

if (request.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}

if (url.pathname === "/api/contact") {
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as {
        name?: string;
        email?: string;
        subject?: string;
        message?: string;
      };

      const name = (body.name || "").trim();
      const email = (body.email || "").trim();
      const subject = (body.subject || "General Inquiry").trim();
      const message = (body.message || "").trim();

      if (!name || !email || !message) {
        return Response.json(
          { success: false, error: "نوم، ایمیل، او پیغام حتمي دي." },
          { status: 400, headers: corsHeaders }
        );
      }

      await env.DB.prepare(
        "INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)"
      )
        .bind(name, email, subject, message)
        .run();

      return Response.json(
        { success: true, message: "ستاسو پیغام په بریالیتوب سره واستول شو." },
        { status: 201, headers: corsHeaders }
      );
    } catch {
      return Response.json(
        { success: false, error: "د پیغام په خوندي کولو کې ستونزه راغله." },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return Response.json(
    { error: "Method Not Allowed" },
    { status: 405, headers: corsHeaders }
  );
}

if (url.pathname === "/api/admin/login") {
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { password?: string };
      const password = (body.password || "").trim();
      const secret = (env.ADMIN_SECRET || "").trim();

      if (!secret) {
        return Response.json(
          { success: false, error: "ADMIN_SECRET په Cloudflare Worker کې تنظیم شوی نه دی." },
          { status: 500, headers: corsHeaders }
        );
      }

      if (!password || password !== secret) {
        return Response.json(
          { success: false, error: "پاسورډ سم نه دی." },
          { status: 401, headers: corsHeaders }
        );
      }

      return Response.json(
        { success: true, token: secret },
        { status: 200, headers: corsHeaders }
      );
    } catch {
      return Response.json(
        { success: false, error: "د ننوتلو پر مهال ستونزه راغله." },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  return Response.json(
    { error: "Method Not Allowed" },
    { status: 405, headers: corsHeaders }
  );
}

if (url.pathname === "/api/articles") {
  if (request.method === "GET") {
    try {
      const status = url.searchParams.get("status");
      const search = (url.searchParams.get("search") || "").trim().toLowerCase();

      let sql = "SELECT * FROM articles";
      const conditions: string[] = [];
      const bindings: unknown[] = [];

      if (status && status !== "all") {
        conditions.push("status = ?");
        bindings.push(status);
      }

      if (search) {
        conditions.push(
          "(LOWER(title_en) LIKE ? OR LOWER(COALESCE(title_ps, '')) LIKE ? OR LOWER(COALESCE(title_fa, '')) LIKE ? OR LOWER(category) LIKE ?)"
        );
        const pattern = `%${search}%`;
        bindings.push(pattern, pattern, pattern, pattern);
      }

      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY updated_at DESC, id DESC";

      const result = await env.DB.prepare(sql).bind(...bindings).all();
      return Response.json(
        { success: true, articles: result.results ?? [] },
        { status: 200, headers: corsHeaders }
      );
    } catch {
      return Response.json(
        { success: false, error: "د خبرونو په راوستلو کې ستونزه راغله." },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (request.method === "POST") {
    if (!isAuthorized(request, env)) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      const body = (await request.json()) as {
        title_en?: string;
        summary_en?: string;
        content_en?: string;
        title_ps?: string;
        summary_ps?: string;
        content_ps?: string;
        title_fa?: string;
        summary_fa?: string;
        content_fa?: string;
        category?: string;
        subcategory?: string;
        status?: string;
        author_name?: string;
        cover_image?: string;
        slug?: string;
      };

      const titleEn = (body.title_en || body.title_ps || body.title_fa || "").trim();
      const summaryEn = (body.summary_en || body.summary_ps || body.summary_fa || "").trim();
      const contentEn = (body.content_en || body.content_ps || body.content_fa || "").trim();

      if (!titleEn || !contentEn) {
        return Response.json(
          { success: false, error: "سرلیک او متن حتمي دي." },
          { status: 400, headers: corsHeaders }
        );
      }

      const baseSlug = slugify(body.slug || titleEn);
      const slug = `${baseSlug}-${Date.now().toString(36)}`;
      const category = (body.category || "world").trim();
      const subcategory = (body.subcategory || "").trim() || null;
      const status = (body.status || "published").trim();
      const authorName = (body.author_name || "Buddha Newsroom").trim();
      const coverImage = (body.cover_image || "/og-fallback.svg").trim();

      const insertResult = await env.DB.prepare(
        `INSERT INTO articles (
          slug, category, subcategory, status, author_name, cover_image,
          title_en, summary_en, content_en,
          title_ps, summary_ps, content_ps,
          title_fa, summary_fa, content_fa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          slug,
          category,
          subcategory,
          status,
          authorName,
          coverImage,
          titleEn,
          summaryEn || titleEn,
          contentEn,
          (body.title_ps || "").trim() || null,
          (body.summary_ps || "").trim() || null,
          (body.content_ps || "").trim() || null,
          (body.title_fa || "").trim() || null,
          (body.summary_fa || "").trim() || null,
          (body.content_fa || "").trim() || null
        )
        .run();

      return Response.json(
        {
          success: true,
          id: insertResult.meta?.last_row_id,
          slug,
          message: "خبر په بریالیتوب سره اضافه شو.",
        },
        { status: 201, headers: corsHeaders }
      );
    } catch {
      return Response.json(
        { success: false, error: "د خبر په خوندي کولو کې ستونزه راغله." },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return Response.json(
    { error: "Method Not Allowed" },
    { status: 405, headers: corsHeaders }
  );
}

const articleMatch = url.pathname.match(/^\/api\/articles\/(\d+)$/);
if (articleMatch) {
  const id = Number(articleMatch[1]);

  if (request.method === "PUT") {
    if (!isAuthorized(request, env)) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      const body = (await request.json()) as {
        title_en?: string;
        summary_en?: string;
        content_en?: string;
        title_ps?: string;
        summary_ps?: string;
        content_ps?: string;
        title_fa?: string;
        summary_fa?: string;
        content_fa?: string;
        category?: string;
        subcategory?: string;
        status?: string;
        author_name?: string;
        cover_image?: string;
      };

      const existing = await env.DB.prepare("SELECT * FROM articles WHERE id = ?")
        .bind(id)
        .first<Record<string, unknown>>();

      if (!existing) {
        return Response.json(
          { success: false, error: "خبر ونه موندل شو." },
          { status: 404, headers: corsHeaders }
        );
      }

      await env.DB.prepare(
        `UPDATE articles SET
          category = ?,
          subcategory = ?,
          status = ?,
          author_name = ?,
          cover_image = ?,
          title_en = ?,
          summary_en = ?,
          content_en = ?,
          title_ps = ?,
          summary_ps = ?,
          content_ps = ?,
          title_fa = ?,
          summary_fa = ?,
          content_fa = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
      )
        .bind(
          (body.category ?? existing.category) as string,
          body.subcategory !== undefined ? (body.subcategory || null) : (existing.subcategory as string | null),
          (body.status ?? existing.status) as string,
          (body.author_name ?? existing.author_name) as string,
          (body.cover_image ?? existing.cover_image) as string,
          (body.title_en ?? existing.title_en) as string,
          (body.summary_en ?? existing.summary_en) as string,
          (body.content_en ?? existing.content_en) as string,
          body.title_ps !== undefined ? (body.title_ps || null) : (existing.title_ps as string | null),
          body.summary_ps !== undefined ? (body.summary_ps || null) : (existing.summary_ps as string | null),
          body.content_ps !== undefined ? (body.content_ps || null) : (existing.content_ps as string | null),
          body.title_fa !== undefined ? (body.title_fa || null) : (existing.title_fa as string | null),
          body.summary_fa !== undefined ? (body.summary_fa || null) : (existing.summary_fa as string | null),
          body.content_fa !== undefined ? (body.content_fa || null) : (existing.content_fa as string | null),
          id
        )
        .run();

      return Response.json(
        { success: true, message: "خبر په بریالیتوب سره تازه شو." },
        { status: 200, headers: corsHeaders }
      );
    } catch {
      return Response.json(
        { success: false, error: "د خبر په سمولو کې ستونزه راغله." },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (request.method === "DELETE") {
    if (!isAuthorized(request, env)) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      await env.DB.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
      return Response.json(
        { success: true, message: "خبر په بریالیتوب سره لرې شو." },
        { status: 200, headers: corsHeaders }
      );
    } catch {
      return Response.json(
        { success: false, error: "د خبر په لرې کولو کې ستونزه راغله." },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return Response.json(
    { error: "Method Not Allowed" },
    { status: 405, headers: corsHeaders }
  );
}

return env.ASSETS.fetch(request);
},
};
