export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_SECRET?: string;
  CHIEF_EDITOR_SECRET?: string;
  REPORTER_SECRET?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type StaffRole = "owner" | "chief_editor" | "reporter";

function resolveStaffRoleSync(request: Request, env: Env): StaffRole | null {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  const ownerSecret = (env.ADMIN_SECRET || "").trim();
  const chiefSecret = (env.CHIEF_EDITOR_SECRET || "").trim();
  const reporterSecret = (env.REPORTER_SECRET || "").trim();

  if (ownerSecret && token === ownerSecret) return "owner";
  if (chiefSecret && token === chiefSecret) return "chief_editor";
  if (reporterSecret && token === reporterSecret) return "reporter";
  return null;
}

function isAuthorized(request: Request, env: Env): boolean {
  return await resolveStaffRoleAsync(request, env) !== null;
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode("bn_salt_v1:" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateSixDigitCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

async function sendStaffEmail(env: Env, to: string, subject: string, text: string): Promise<{ sent: boolean }> {
  const apiKey = (env.RESEND_API_KEY || "").trim();
  const from = (env.MAIL_FROM || "Buddha News <noreply@buddhanews.org>").trim();
  if (!apiKey) return { sent: false };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}

async function resolveStaffRoleAsync(request: Request, env: Env): Promise<StaffRole | null> {
  const syncRole = resolveStaffRoleSync(request, env);
  if (syncRole) return syncRole;
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token.startsWith("staff:")) return null;
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const email = decodeURIComponent(parts[1] || "").toLowerCase().trim();
  const passHash = parts[2] || "";
  if (!email || !passHash) return null;
  const user = await env.DB.prepare(
    "SELECT role, password_hash, active, verified FROM staff_users WHERE LOWER(email) = ? LIMIT 1"
  ).bind(email).first<{ role: StaffRole; password_hash: string | null; active: number; verified: number }>();
  if (!user || !user.active || !user.verified || !user.password_hash || user.password_hash !== passHash) return null;
  return user.role;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `story-${Date.now()}`
  );
}

function rowToArticleDTO(row: Record<string, unknown>, index = 0) {
  const slug = String(row.slug || `story-${row.id}`);
  const titleEn = String(row.title_en || "Untitled story");
  const summaryEn = row.summary_en ? String(row.summary_en) : null;
  const contentEn = row.content_en ? String(row.content_en) : null;

  const translations: Array<Record<string, unknown>> = [
    {
      locale: "en",
      slug,
      title: titleEn,
      summary: summaryEn,
      content: contentEn,
      seoTitle: titleEn,
      seoDescription: summaryEn,
      aiSummary: null,
      aiSummaryAt: null,
    },
  ];

  if (row.title_ps || row.content_ps) {
    translations.push({
      locale: "ps",
      slug,
      title: String(row.title_ps || titleEn),
      summary: row.summary_ps ? String(row.summary_ps) : summaryEn,
      content: row.content_ps ? String(row.content_ps) : contentEn,
      seoTitle: String(row.title_ps || titleEn),
      seoDescription: row.summary_ps ? String(row.summary_ps) : summaryEn,
      aiSummary: null,
      aiSummaryAt: null,
    });
  }

  if (row.title_fa || row.content_fa) {
    translations.push({
      locale: "fa",
      slug,
      title: String(row.title_fa || titleEn),
      summary: row.summary_fa ? String(row.summary_fa) : summaryEn,
      content: row.content_fa ? String(row.content_fa) : contentEn,
      seoTitle: String(row.title_fa || titleEn),
      seoDescription: row.summary_fa ? String(row.summary_fa) : summaryEn,
      aiSummary: null,
      aiSummaryAt: null,
    });
  }

  const wordCount = (contentEn || "").split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    id: Number(row.id),
    slug,
    status: (row.status as "draft" | "published" | "archived") || "published",
    category: String(row.category || "world"),
    subcategory: row.subcategory ? String(row.subcategory) : null,
    coverImage: row.cover_image ? String(row.cover_image) : "/og-fallback.svg",
    coverAlt: titleEn,
    authorName: String(row.author_name || "Buddha Newsroom"),
    authorAvatar: row.author_avatar ? String(row.author_avatar) : null,
    authorLocation: row.author_location ? String(row.author_location) : null,
    authorBio: row.author_bio ? String(row.author_bio) : null,
    featured: index === 0,
    breaking: false,
    readMinutes,
    tags: [],
    publishedAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    updatedAt: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
    views: Number(row.views || 0),
    isDemo: false,
    translations,
  };
}

async function handleTrpcProcedure(
  proc: string,
  input: Record<string, unknown>,
  env: Env
): Promise<unknown> {
  if (proc === "articles.list" || proc === "articles.mostRead") {
    const category = typeof input.category === "string" ? input.category.trim() : "";
    const search = typeof input.search === "string" ? input.search.trim().toLowerCase() : "";
    const limit = typeof input.limit === "number" ? Math.min(Math.max(input.limit, 1), 100) : 40;

    let sql = "SELECT * FROM articles WHERE status = 'published'";
    const bindings: unknown[] = [];

    if (category) {
      sql += " AND category = ?";
      bindings.push(category);
    }

    if (search) {
      sql +=
        " AND (LOWER(title_en) LIKE ? OR LOWER(COALESCE(title_ps, '')) LIKE ? OR LOWER(COALESCE(title_fa, '')) LIKE ? OR LOWER(COALESCE(summary_en, '')) LIKE ? OR LOWER(COALESCE(author_name, '')) LIKE ?)";
      const pattern = `%${search}%`;
      bindings.push(pattern, pattern, pattern, pattern, pattern);
    }

    sql += " ORDER BY updated_at DESC, id DESC LIMIT ?";
    bindings.push(limit);

    const res = await env.DB.prepare(sql).bind(...bindings).all();
    const rows = (res.results ?? []) as Array<Record<string, unknown>>;
    return rows.map((row, idx) => rowToArticleDTO(row, idx));
  }

  if (proc === "articles.get") {
    const slug = typeof input.slug === "string" ? input.slug.trim() : "";
    if (!slug) return { article: null, related: [] };
    const row = await env.DB.prepare("SELECT * FROM articles WHERE slug = ? LIMIT 1")
      .bind(slug)
      .first<Record<string, unknown>>();
    if (!row) return { article: null, related: [] };
    const article = rowToArticleDTO(row, 0);

    const relatedRes = await env.DB.prepare(
      "SELECT * FROM articles WHERE status = 'published' AND id != ? ORDER BY updated_at DESC, id DESC LIMIT 3"
    )
      .bind(row.id)
      .all();
    const related = ((relatedRes.results ?? []) as Array<Record<string, unknown>>).map((r, i) =>
      rowToArticleDTO(r, i + 1)
    );

    return { article, related };
  }

  if (proc === "articles.view") {
    return { ok: true };
  }

  if (proc === "articles.aiSummary") {
    return { summary: "" };
  }

  if (proc === "settings.public") {
    return {
      siteName: "Buddha News",
      contactEmail: "newsroom@buddhanews.org",
      tipLineSignal: "",
      breakingBanner: "",
    };
  }

  if (proc === "newsletter.subscribe") {
    return { success: true };
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname.startsWith("/api/trpc/")) {
      const rawProcs = url.pathname.slice("/api/trpc/".length);
      const procs = rawProcs.split(",").map(p => p.trim()).filter(Boolean);
      const isBatch = url.searchParams.get("batch") === "1";

      let parsedInputs: Record<string, { json?: Record<string, unknown> }> = {};
      try {
        if (request.method === "GET") {
          const inputParam = url.searchParams.get("input");
          if (inputParam) {
            parsedInputs = JSON.parse(inputParam);
          }
        } else if (request.method === "POST") {
          const bodyText = await request.text();
          if (bodyText) {
            parsedInputs = JSON.parse(bodyText);
          }
        }
      } catch {
        parsedInputs = {};
      }

      try {
        if (isBatch) {
          const results = await Promise.all(
            procs.map(async (proc, idx) => {
              const entry = parsedInputs[String(idx)];
              const input = (entry && typeof entry.json === "object" && entry.json) || {};
              const data = await handleTrpcProcedure(proc, input, env);
              return { result: { data: { json: data } } };
            })
          );
          return Response.json(results, { status: 200, headers: corsHeaders });
        } else {
          const proc = procs[0] || "";
          const input =
            (parsedInputs && typeof (parsedInputs as { json?: Record<string, unknown> }).json === "object"
              ? (parsedInputs as { json?: Record<string, unknown> }).json
              : parsedInputs) || {};
          const data = await handleTrpcProcedure(proc, input as Record<string, unknown>, env);
          return Response.json(
            { result: { data: { json: data } } },
            { status: 200, headers: corsHeaders }
          );
        }
      } catch {
        return Response.json(
          isBatch
            ? procs.map(() => ({ result: { data: { json: [] } } }))
            : { result: { data: { json: null } } },
          { status: 200, headers: corsHeaders }
        );
      }
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

    if (url.pathname === "/api/staff/login" && request.method === "POST") {
      try {
        const body = (await request.json()) as { email?: string; password?: string };
        const email = (body.email || "").toLowerCase().trim();
        const password = (body.password || "").trim();
        if (!email || !password) {
          return Response.json({ success: false, error: "Email and password are required." }, { status: 400, headers: corsHeaders });
        }
        const user = await env.DB.prepare(
          "SELECT id, name, email, role, password_hash, verified, active FROM staff_users WHERE LOWER(email) = ? LIMIT 1"
        ).bind(email).first<{ id: number; name: string; email: string; role: StaffRole; password_hash: string | null; verified: number; active: number }>();
        if (!user || !user.active) {
          return Response.json({ success: false, error: "Account not found or inactive." }, { status: 401, headers: corsHeaders });
        }
        if (!user.verified || !user.password_hash) {
          return Response.json({ success: false, needsVerification: true, error: "Email not verified yet. Request a code and set your password first." }, { status: 403, headers: corsHeaders });
        }
        const passHash = await hashPassword(password);
        if (passHash !== user.password_hash) {
          return Response.json({ success: false, error: "Invalid email or password." }, { status: 401, headers: corsHeaders });
        }
        const token = "staff:" + encodeURIComponent(user.email) + ":" + passHash;
        return Response.json({ success: true, token, role: user.role, name: user.name, email: user.email }, { status: 200, headers: corsHeaders });
      } catch {
        return Response.json({ success: false, error: "Login error occurred." }, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/staff/request-code" && request.method === "POST") {
      try {
        const body = (await request.json()) as { email?: string };
        const email = (body.email || "").toLowerCase().trim();
        if (!email) {
          return Response.json({ success: false, error: "Official email is required." }, { status: 400, headers: corsHeaders });
        }
        const user = await env.DB.prepare(
          "SELECT id, name, active FROM staff_users WHERE LOWER(email) = ? LIMIT 1"
        ).bind(email).first<{ id: number; name: string; active: number }>();
        if (!user || !user.active) {
          return Response.json({ success: false, error: "This email is not registered by the owner." }, { status: 404, headers: corsHeaders });
        }
        const code = generateSixDigitCode();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await env.DB.prepare(
          "UPDATE staff_users SET verification_code = ?, code_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(code, expiresAt, user.id).run();
        const emailRes = await sendStaffEmail(env, email, "Buddha News — Verification & Password Reset Code", "Hello " + user.name + ",\n\nYour verification code is: " + code + "\nExpires in 30 minutes.");
        return Response.json({ success: true, emailSent: emailRes.sent, message: emailRes.sent ? "Verification code sent to your official email." : "Verification code generated. Get the code from the Owner if email is not set up yet." }, { status: 200, headers: corsHeaders });
      } catch {
        return Response.json({ success: false, error: "Failed to send verification code." }, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/staff/reset-password" && request.method === "POST") {
      try {
        const body = (await request.json()) as { email?: string; code?: string; newPassword?: string };
        const email = (body.email || "").toLowerCase().trim();
        const code = (body.code || "").trim();
        const newPassword = (body.newPassword || "").trim();
        if (!email || !code || newPassword.length < 8) {
          return Response.json({ success: false, error: "Email, 6-digit code, and 8+ char password are required." }, { status: 400, headers: corsHeaders });
        }
        const user = await env.DB.prepare(
          "SELECT id, verification_code, code_expires_at, active FROM staff_users WHERE LOWER(email) = ? LIMIT 1"
        ).bind(email).first<{ id: number; verification_code: string | null; code_expires_at: string | null; active: number }>();
        if (!user || !user.active || !user.verification_code || user.verification_code !== code) {
          return Response.json({ success: false, error: "Invalid verification code." }, { status: 400, headers: corsHeaders });
        }
        if (user.code_expires_at && new Date(user.code_expires_at).getTime() < Date.now()) {
          return Response.json({ success: false, error: "Verification code expired." }, { status: 400, headers: corsHeaders });
        }
        const passHash = await hashPassword(newPassword);
        await env.DB.prepare(
          "UPDATE staff_users SET password_hash = ?, verified = 1, verification_code = NULL, code_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(passHash, user.id).run();
        return Response.json({ success: true, message: "Email verified and new password saved. You can sign in now." }, { status: 200, headers: corsHeaders });
      } catch {
        return Response.json({ success: false, error: "Failed to reset password." }, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/staff/users") {
      const role = await resolveStaffRoleAsync(request, env);
      if (role !== "owner") {
        return Response.json({ success: false, error: "Only the Owner can manage staff accounts." }, { status: 403, headers: corsHeaders });
      }
      if (request.method === "GET") {
        const res = await env.DB.prepare("SELECT id, name, email, role, verified, active, verification_code, created_at FROM staff_users ORDER BY id DESC").all();
        return Response.json({ success: true, users: res.results ?? [] }, { status: 200, headers: corsHeaders });
      }
      if (request.method === "POST") {
        const body = (await request.json()) as { name?: string; email?: string; role?: StaffRole };
        const name = (body.name || "").trim();
        const email = (body.email || "").toLowerCase().trim();
        const staffRole: StaffRole = body.role === "chief_editor" || body.role === "owner" ? body.role : "reporter";
        if (!name || !email) {
          return Response.json({ success: false, error: "Name and official email are required." }, { status: 400, headers: corsHeaders });
        }
        const code = generateSixDigitCode();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          "INSERT INTO staff_users (name, email, role, verified, active, verification_code, code_expires_at) VALUES (?, ?, ?, 0, 1, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = excluded.role, active = 1, verification_code = excluded.verification_code, code_expires_at = excluded.code_expires_at, updated_at = CURRENT_TIMESTAMP"
        ).bind(name, email, staffRole, code, expiresAt).run();
        const emailRes = await sendStaffEmail(env, email, "Buddha News — Official Staff Account Verification", "Hello " + name + ",\n\nRole: " + staffRole + "\nVerification code: " + code);
        return Response.json({ success: true, code, emailSent: emailRes.sent, message: "Staff user saved." }, { status: 201, headers: corsHeaders });
      }
      if (request.method === "DELETE") {
        const id = Number(url.searchParams.get("id") || 0);
        if (!id) {
          return Response.json({ success: false, error: "User ID is required." }, { status: 400, headers: corsHeaders });
        }
        await env.DB.prepare("DELETE FROM staff_users WHERE id = ?").bind(id).run();
        return Response.json({ success: true, message: "Staff user removed." }, { status: 200, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/admin/login") {
      if (request.method === "POST") {
        try {
          const body = (await request.json()) as { password?: string; role?: StaffRole };
          const password = (body.password || "").trim();
          const ownerSecret = (env.ADMIN_SECRET || "").trim();
          const chiefSecret = (env.CHIEF_EDITOR_SECRET || "").trim();
          const reporterSecret = (env.REPORTER_SECRET || "").trim();

          if (!ownerSecret && !chiefSecret && !reporterSecret) {
            return Response.json(
              { success: false, error: "په Cloudflare Worker کې د ننوتلو پټ کوډ تنظیم شوی نه دی." },
              { status: 500, headers: corsHeaders }
            );
          }

          if (!password) {
            return Response.json(
              { success: false, error: "پاسورډ سم نه دی." },
              { status: 401, headers: corsHeaders }
            );
          }

          let matchedRole: StaffRole | null = null;
          if (ownerSecret && password === ownerSecret) matchedRole = "owner";
          else if (chiefSecret && password === chiefSecret) matchedRole = "chief_editor";
          else if (reporterSecret && password === reporterSecret) matchedRole = "reporter";

          if (!matchedRole) {
            return Response.json(
              { success: false, error: "پاسورډ سم نه دی." },
              { status: 401, headers: corsHeaders }
            );
          }

          if (body.role && body.role !== matchedRole && matchedRole !== "owner") {
            return Response.json(
              { success: false, error: "دا پټ کوډ د دې رول لپاره نه دی." },
              { status: 403, headers: corsHeaders }
            );
          }

          return Response.json(
            { success: true, token: password, role: matchedRole },
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
              "(LOWER(title_en) LIKE ? OR LOWER(COALESCE(title_ps, '')) LIKE ? OR LOWER(COALESCE(title_fa, '')) LIKE ? OR LOWER(category) LIKE ? OR LOWER(COALESCE(author_name, '')) LIKE ?)"
            );
            const pattern = `%${search}%`;
            bindings.push(pattern, pattern, pattern, pattern, pattern);
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
        const role = await resolveStaffRoleAsync(request, env);
        if (!role) {
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
            author_avatar?: string;
            author_location?: string;
            author_bio?: string;
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
          const requestedStatus = (body.status || "published").trim();
          const status =
            role === "reporter"
              ? "pending_approval"
              : requestedStatus;
          const authorName = (body.author_name || "Buddha Newsroom").trim();
          const authorAvatar = (body.author_avatar || "").trim() || null;
          const authorLocation = (body.author_location || "").trim() || null;
          const authorBio = (body.author_bio || "").trim() || null;
          const coverImage = (body.cover_image || "/og-fallback.svg").trim();

          const insertResult = await env.DB.prepare(
            `INSERT INTO articles (
              slug, category, subcategory, status,
              author_name, author_avatar, author_location, author_bio,
              cover_image,
              title_en, summary_en, content_en,
              title_ps, summary_ps, content_ps,
              title_fa, summary_fa, content_fa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              slug,
              category,
              subcategory,
              status,
              authorName,
              authorAvatar,
              authorLocation,
              authorBio,
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
        const role = await resolveStaffRoleAsync(request, env);
        if (!role || role === "reporter") {
          return Response.json(
            { success: false, error: "یوازې Chief Editor یا Owner راپورونه سمولی او تصویبولی شي." },
            { status: 403, headers: corsHeaders }
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
            author_avatar?: string;
            author_location?: string;
            author_bio?: string;
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
              author_avatar = ?,
              author_location = ?,
              author_bio = ?,
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
              body.subcategory !== undefined
                ? body.subcategory || null
                : (existing.subcategory as string | null),
              (body.status ?? existing.status) as string,
              (body.author_name ?? existing.author_name) as string,
              body.author_avatar !== undefined
                ? body.author_avatar || null
                : (existing.author_avatar as string | null),
              body.author_location !== undefined
                ? body.author_location || null
                : (existing.author_location as string | null),
              body.author_bio !== undefined
                ? body.author_bio || null
                : (existing.author_bio as string | null),
              (body.cover_image ?? existing.cover_image) as string,
              (body.title_en ?? existing.title_en) as string,
              (body.summary_en ?? existing.summary_en) as string,
              (body.content_en ?? existing.content_en) as string,
              body.title_ps !== undefined
                ? body.title_ps || null
                : (existing.title_ps as string | null),
              body.summary_ps !== undefined
                ? body.summary_ps || null
                : (existing.summary_ps as string | null),
              body.content_ps !== undefined
                ? body.content_ps || null
                : (existing.content_ps as string | null),
              body.title_fa !== undefined
                ? body.title_fa || null
                : (existing.title_fa as string | null),
              body.summary_fa !== undefined
                ? body.summary_fa || null
                : (existing.summary_fa as string | null),
              body.content_fa !== undefined
                ? body.content_fa || null
                : (existing.content_fa as string | null),
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
        const role = await resolveStaffRoleAsync(request, env);
        if (!role || role === "reporter") {
          return Response.json(
            { success: false, error: "یوازې Chief Editor یا Owner راپورونه لرې کولی شي." },
            { status: 403, headers: corsHeaders }
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
