export type BuddhaAIRequest = {
  question?: string;
  articleSlug?: string;
};

/** Opens the global Buddha AI drawer from anywhere in the public site. */
export function askBuddhaAI(request: BuddhaAIRequest = {}) {
  window.dispatchEvent(new CustomEvent<BuddhaAIRequest>("buddha:ai", { detail: request }));
}
