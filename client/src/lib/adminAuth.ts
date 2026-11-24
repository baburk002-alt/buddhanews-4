const TOKEN_KEY = "buddhanews_admin_token";
const ROLE_KEY = "buddhanews_admin_role";
const USER_KEY = "buddhanews_admin_user";

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

export function getStaffUserLabel(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string, role?: UserRole, userLabel?: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (role) {
      localStorage.setItem(ROLE_KEY, role);
    }
    if (userLabel) {
      localStorage.setItem(USER_KEY, userLabel);
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
    localStorage.removeItem(USER_KEY);
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
  setAdminToken(data.token, resolvedRole, resolvedRole.toUpperCase());
  return { ok: true, role: resolvedRole };
}

export async function loginWithStaffEmail(
  email: string,
  password: string
): Promise<{ ok: boolean; role?: UserRole; needsVerification?: boolean; error?: string }> {
  const res = await fetch("/api/staff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as {
    success?: boolean;
    token?: string;
    role?: UserRole;
    name?: string;
    email?: string;
    needsVerification?: boolean;
    error?: string;
  };
  if (!res.ok || !data.success || !data.token) {
    return {
      ok: false,
      needsVerification: Boolean(data.needsVerification),
      error: data.error || "ایمیل یا پاسورډ سم نه دی.",
    };
  }
  const resolvedRole: UserRole = data.role || "reporter";
  setAdminToken(data.token, resolvedRole, data.name ? data.name + " (" + (data.email || "") + ")" : data.email);
  return { ok: true, role: resolvedRole };
}

export async function requestStaffCode(
  email: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch("/api/staff/request-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || "د کوډ په لېږلو کې ستونزه راغله." };
  }
  return { ok: true, message: data.message };
}

export async function resetStaffPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch("/api/staff/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });
  const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || "د پاسورډ په بدلولو کې ستونزه راغله." };
  }
  return { ok: true, message: data.message };
}
