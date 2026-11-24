import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { getAdminToken, getUserRole } from "@/lib/adminAuth";

interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: "owner" | "chief_editor" | "reporter";
  verified: number;
  active: number;
  verification_code?: string | null;
  created_at?: string;
}

export function StaffAccountsPanel() {
  const role = getUserRole() || "owner";
  const isOwner = role === "owner";

  const [users, setUsers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState<"chief_editor" | "reporter">("reporter");
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!isOwner) return;
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/staff/users", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = (await res.json()) as { success?: boolean; users?: StaffMember[] };
      if (res.ok && data.success) {
        setUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleAddStaff(e: FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    const token = getAdminToken();
    if (!token || !name.trim() || !email.trim()) {
      toast.error("Name and official email are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/staff/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role: staffRole }),
      });
      const data = (await res.json()) as { success?: boolean; code?: string; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add staff member.");
      }
      toast.success("Staff member added. Verification code: " + (data.code || ""));
      setName("");
      setEmail("");
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number) {
    const token = getAdminToken();
    if (!token) return;
    const res = await fetch("/api/staff/users?id=" + id, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    if (res.ok) {
      toast.success("Staff member removed.");
      await loadUsers();
    }
  }

  if (!isOwner) {
    return (
      <div dir="ltr" className="rounded-lg border border-line bg-card p-5 text-xs text-muted-foreground">
        Staff account and official email management is restricted to the Owner.
      </div>
    );
  }

  return (
    <div dir="ltr" className="space-y-4 rounded-lg border border-line bg-card p-6 text-left text-xs">
      <div>
        <h2 className="font-display text-base font-bold text-foreground">
          Staff Accounts & Official Emails
        </h2>
        <p className="mt-1 text-muted-foreground">
          Add a Chief Editor or Reporter by their official email so they can verify their email and set a password.
        </p>
      </div>

      <form onSubmit={handleAddStaff} className="grid gap-3 sm:grid-cols-4">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Staff full name"
          className="h-10 rounded-md border border-line bg-background px-3 text-foreground"
        />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="staff@yourdomain.com"
          className="h-10 rounded-md border border-line bg-background px-3 text-foreground"
        />
        <select
          value={staffRole}
          onChange={e => setStaffRole(e.target.value as "chief_editor" | "reporter")}
          className="h-10 rounded-md border border-line bg-background px-3 text-foreground"
        >
          <option value="reporter">Reporter</option>
          <option value="chief_editor">Chief Editor</option>
        </select>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-ink px-4 font-bold text-paper hover:bg-brand hover:text-ink disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {saving ? "Saving..." : "Add Staff"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-line text-[0.68rem] uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3">Status / Code</th>
              <th className="py-2 pl-3 text-right">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr><td colSpan={5} className="py-4 text-muted-foreground">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="py-4 text-muted-foreground">No staff email accounts added yet.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-3 font-semibold text-foreground">{u.name}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{u.email}</td>
                  <td className="py-2.5 px-3 font-semibold text-foreground">{u.role}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {u.verified ? "Verified" : "Pending — Code: " + (u.verification_code || "-")}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleRemove(u.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-destructive hover:bg-destructive/10"
                      aria-label="Remove staff member"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
