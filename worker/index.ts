export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

    return env.ASSETS.fetch(request);
  },
};
