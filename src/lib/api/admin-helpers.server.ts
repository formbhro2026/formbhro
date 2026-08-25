/** Server-only helpers for the admin server functions. */

export async function assertAdmin(context: {
  supabase: { rpc: (fn: "is_admin") => PromiseLike<{ data: unknown }> };
}) {
  const { data } = await context.supabase.rpc("is_admin");
  if (data !== true) throw new Error("Forbidden");
}

/** Temporary super-admin gate credentials (migrating to Supabase admin accounts later). */
export const ADMIN_GATE_USERNAME = "admin";
export const ADMIN_GATE_PASSWORD = "ADMIN@2026";
export const ADMIN_GATE_EMAIL = "admin@formbhro.com";
