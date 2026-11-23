// Only these public values may reach the browser. Never serialize process.env.
export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? "",
    // Public by design (it is embedded in the widget). Only exposed when the
    // secret is also configured, so the forms never show a widget the server
    // would not verify.
    turnstileSiteKey:
      (env.TURNSTILE_SITE_KEY ?? "").trim() && (env.TURNSTILE_SECRET_KEY ?? "").trim()
        ? (env.TURNSTILE_SITE_KEY ?? "").trim()
        : "",
  };
}

export function publicPlatformScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}
