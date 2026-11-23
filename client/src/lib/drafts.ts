/**
 * Device-local editor drafts.
 *
 * Drafts used to live under a single `bn-draft:<id>` key, so a story typed by
 * one editor was offered back to whoever opened the browser next. They are now:
 *
 *  - scoped by user id            `bn-draft:v2:<userId>:<new|articleId>`
 *  - given a time-to-live         (7 days; expired entries are purged)
 *  - wiped on logout, after a successful save/publish, and whenever the
 *    signed-in user changes (other users' and legacy un-scoped keys are removed)
 *
 * Nothing here ever touches the server and every call tolerates blocked or full
 * storage, because writing must never be interrupted by a storage error.
 */
const PREFIX = "bn-draft:";
const VERSION_PREFIX = `${PREFIX}v2:`;
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredDraft<T> = { savedAt: string; expiresAt: number; form: T };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function draftKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

export function draftKey(userId: number | string, articleId: number | "new"): string {
  return `${VERSION_PREFIX}${userId}:${articleId}`;
}

export function readDraft<T>(key: string, now = Date.now()): StoredDraft<T> | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft<T>>;
    if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now || !parsed.form) {
      store.removeItem(key);
      return null;
    }
    return { savedAt: parsed.savedAt ?? "", expiresAt: parsed.expiresAt, form: parsed.form };
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, form: T, now = Date.now()): string | null {
  const store = storage();
  if (!store) return null;
  const savedAt = new Date(now).toISOString();
  try {
    store.setItem(key, JSON.stringify({ savedAt, expiresAt: now + DRAFT_TTL_MS, form }));
    return savedAt;
  } catch {
    return null;
  }
}

export function removeDraft(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

/** Remove every draft on this device (logout / session loss). */
export function clearAllDrafts(): void {
  const store = storage();
  if (!store) return;
  try {
    for (const key of draftKeys(store)) store.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

/**
 * TTL cleanup. Removes expired drafts, legacy un-scoped drafts and, when a user
 * id is given, drafts that belong to anyone else.
 */
export function purgeDrafts(userId: number | string | null, now = Date.now()): number {
  const store = storage();
  if (!store) return 0;
  let removed = 0;
  try {
    for (const key of draftKeys(store)) {
      let drop = false;
      if (userId === null) {
        drop = true;
      } else if (!key.startsWith(VERSION_PREFIX)) {
        drop = true; // legacy key written before drafts were user-scoped
      } else if (!key.startsWith(`${VERSION_PREFIX}${userId}:`)) {
        drop = true; // another user's draft
      } else {
        try {
          const parsed = JSON.parse(store.getItem(key) ?? "null") as { expiresAt?: number } | null;
          drop = !parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now;
        } catch {
          drop = true;
        }
      }
      if (drop) {
        store.removeItem(key);
        removed += 1;
      }
    }
  } catch {
    // ignore storage failures
  }
  return removed;
}
