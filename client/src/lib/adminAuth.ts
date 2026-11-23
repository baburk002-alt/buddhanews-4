const TOKEN_KEY = "buddhanews_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new Event("buddhanews-admin-auth"));
  } catch {
    // ignore storage errors
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("buddhanews-admin-auth"));
  } catch {
    // ignore storage errors
  }
}

export async function loginWithSecret(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json()) as { success?: boolean; token?: string; error?: string };
  if (!res.ok || !data.success || !data.token) {
    return { ok: false, error: data.error || "پاسورډ سم نه دی." };
  }
  setAdminToken(data.token);
  return { ok: true };
}
