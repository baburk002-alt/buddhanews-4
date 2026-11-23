/**
 * Values that ship with the demonstration content. The launch checklist
 * (server/launchCheck.ts) treats them as "not ready for real readers".
 */
export const DEMO_CONTACT_EMAILS = [
  "newsroom@buddhanews.example",
  "newsroom@buddhans.example",
] as const;

/** True for empty-ish, `.example`/`example.com`/`localhost` and known demo addresses. */
export function isPlaceholderEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (!email) return true;
  if ((DEMO_CONTACT_EMAILS as readonly string[]).includes(email)) return true;
  const domain = email.split("@")[1] ?? "";
  return (
    !domain ||
    domain === "localhost" ||
    domain.endsWith(".example") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".test") ||
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net"
  );
}

/** Stock/demo imagery shipped with the project lives under these storage prefixes. */
const PLACEHOLDER_IMAGE_MARKERS = ["/manus-storage/async-images/", "async-images/", "placehold", "example.com"];

export function isPlaceholderImage(value: string): boolean {
  const url = value.trim().toLowerCase();
  if (!url) return false;
  return PLACEHOLDER_IMAGE_MARKERS.some(marker => url.includes(marker));
}
