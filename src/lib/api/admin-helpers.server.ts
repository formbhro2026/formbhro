/** Server-only helpers for the admin server functions. */

export async function assertAdmin(context: {
  supabase: { rpc: (fn: "is_admin") => PromiseLike<{ data: unknown }> };
}) {
  const { data } = await context.supabase.rpc("is_admin");
  if (data !== true) throw new Error("Forbidden");
}

/**
 * Asserts caller is either an admin OR a team member (role = 'team' | 'admin').
 * Used for actions any authenticated team account may perform on their own data.
 */
export async function assertTeamOrAdmin(context: {
  supabase: { rpc: (fn: "is_admin" | "is_team") => PromiseLike<{ data: unknown }> };
}) {
  const [{ data: isAdmin }, { data: isTeam }] = await Promise.all([
    context.supabase.rpc("is_admin"),
    context.supabase.rpc("is_team"),
  ]);
  if (isAdmin !== true && isTeam !== true) throw new Error("Forbidden");
}

/**
 * For a team member, asserts they hold a specific permission flag in their
 * team_members.permissions JSONB column.  Admins bypass the check entirely.
 */
export async function assertPermission(
  context: {
    supabase: { rpc: (fn: "is_admin") => PromiseLike<{ data: unknown }> };
    userId: string;
  },
  permission: "can_manage_team" | "can_view_analytics" | "can_delete_messages",
): Promise<void> {
  const { data: isAdmin } = await context.supabase.rpc("is_admin");
  if (isAdmin === true) return; // admins always pass

  // Load the caller's permissions from team_members
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("permissions")
    .eq("id", context.userId)
    .maybeSingle();

  const perms = (member?.permissions ?? {}) as Record<string, boolean>;
  if (!perms[permission]) {
    throw new Error(`Forbidden: requires ${permission}`);
  }
}

/** Super-admin gate credentials. Primary set is the production credentials.
 * Legacy set kept for backwards-compat with any existing scripts/tests. */
export const ADMIN_GATE_USERNAME = "rbrb@9973";
export const ADMIN_GATE_PASSWORD = "Rakesh+Rb@9973";
export const ADMIN_GATE_EMAIL = "rbrb@formbhro.com";

// Legacy fallback (admin / ADMIN@2026)
export const LEGACY_ADMIN_GATE_USERNAME = "admin";
export const LEGACY_ADMIN_GATE_PASSWORD = "ADMIN@2026";
export const LEGACY_ADMIN_GATE_EMAIL = "admin@formbhro.com";
