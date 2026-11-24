const TOKEN_KEY = "buddhanews_admin_token";
const ROLE_KEY = "buddhanews_admin_role";

export type UserRole = "owner" | "chief_editor" | "reporter";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUserRole(): UserRole | null {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (raw === "owner" || raw === "chief_editor" || raw === "reporter") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function setAdminToken(token: string, role?: UserRole): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (role) {
      localStorage.setItem(ROLE_KEY, role);
    }
    window.dispatchEvent(new Event("buddhanews-admin-auth"));
  } catch {
    // ignore storage errors
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    window.dispatchEvent(new Event("buddhanews-admin-auth"));
  } catch {
    // ignore storage errors
  }
}

export async function loginWithSecret(
  password: string,
  requestedRole?: UserRole
): Promise<{ ok: boolean; role?: UserRole; error?: string }> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, role: requestedRole }),
  });
  const data = (await res.json()) as {
    success?: boolean;
    token?: string;
    role?: UserRole;
    error?: string;
  };
  if (!res.ok || !data.success || !data.token) {
    return { ok: false, error: data.error || "پاسورډ سم نه دی." };
  }
  const resolvedRole: UserRole = data.role || requestedRole || "owner";
  setAdminToken(data.token, resolvedRole);
  return { ok: true, role: resolvedRole };
}
