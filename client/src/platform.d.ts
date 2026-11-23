export {};
declare global {
  interface Window {
    __MANUS_CONFIG__?: {
      projectId: string; oauthPortalUrl: string; apiUrl: string; apiBrowserKey: string;
      /** Empty unless TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are both set. */
      turnstileSiteKey?: string;
    };
  }
}
