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
  userId?: string;
}) {
  try {
    const [{ data: isAdmin }, { data: isTeam }] = await Promise.all([
      Promise.resolve(context.supabase.rpc("is_admin")).catch(() => ({ data: false })),
      Promise.resolve(context.supabase.rpc("is_team")).catch(() => ({ data: false })),
    ]);
    if (isAdmin === true || isTeam === true) return;
  } catch (_) {}

  if (context.userId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roleRows }, { data: teamMember }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin.from("team_members").select("is_active").eq("id", context.userId).maybeSingle(),
    ]);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (roles.includes("admin") || roles.includes("team") || teamMember?.is_active) {
      return;
    }
  }

  throw new Error("Forbidden");
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

/** Authorized Super-admin gate credentials. Configurable via environment variables. */
export const ADMIN_GATE_USERNAME = process.env.ADMIN_GATE_USERNAME || "Rakesh@RbRb@Formbhro";
export const ADMIN_GATE_PASSWORD = process.env.ADMIN_GATE_PASSWORD || "Rb@FB@9973@Formbhro";
export const ADMIN_GATE_EMAIL = process.env.ADMIN_GATE_EMAIL || "rbrb@formbhro.com";

