/**
 * Privileged admin operations. Every handler verifies the caller is an admin
 * through their own RLS-scoped client BEFORE loading the service-role client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_GATE_EMAIL,
  ADMIN_GATE_PASSWORD,
  ADMIN_GATE_USERNAME,
  assertAdmin,
} from "./admin-helpers.server";

/**
 * Temporary super-admin gate. The client posts the fixed console credentials;
 * we then make sure a real Supabase auth account with the admin role exists so
 * every subsequent request is authorised by RLS, not by the UI.
 * Replace this with real Supabase admin accounts when auth is migrated.
 */
export const ensureAdminAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ username: z.string().max(120), password: z.string().max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (
      data.username.trim().toLowerCase() !== ADMIN_GATE_USERNAME ||
      data.password !== ADMIN_GATE_PASSWORD
    ) {
      return { ok: false as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server").catch((err) => {
      console.error("Failed to load supabaseAdmin:", err);
      throw new Error(
        "Admin service is currently unavailable. Please check backend configuration.",
      );
    });

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let userId = list?.users.find((u: any) => u.email?.toLowerCase() === ADMIN_GATE_EMAIL)?.id;

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_GATE_EMAIL,
        password: ADMIN_GATE_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Super Admin", role: "admin" },
      });
      if (error || !created.user)
        throw new Error(error?.message ?? "Could not prepare the admin account");
      userId = created.user.id;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: ADMIN_GATE_PASSWORD });
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, full_name: "Super Admin", email: ADMIN_GATE_EMAIL },
        { onConflict: "id" },
      );

    return { ok: true as const, email: ADMIN_GATE_EMAIL, password: ADMIN_GATE_PASSWORD };
  });

/** Admin -> create Team Member. There is no public team signup anywhere. */
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        full_name: z.string().min(2).max(80),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
        avatar_url: z.string().url().max(500).optional().or(z.literal("")),
        password: z.string().min(8).max(72),
        job_title: z.string().min(2).max(60).default("Support Executive"),
        role: z.enum(["team", "admin"]).default("team"),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Generate a proper sequential unique team code FBH-YYMMDD-XXX
    const now = new Date();
    const datePart =
      now.getFullYear().toString().slice(-2) +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0");

    // Get count of members today for sequence
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const { count } = await supabaseAdmin
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay);

    const sequence = ((count || 0) + 1).toString().padStart(3, "0");
    const teamCode = `FBH-${datePart}-${sequence}`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        role: data.role,
        job_title: data.job_title,
        team_code: teamCode,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account");

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        avatar_url: data.avatar_url || null,
        is_active: data.active,
      })
      .eq("id", created.user.id);

    await supabaseAdmin.from("team_members").upsert(
      {
        id: created.user.id,
        job_title: data.job_title,
        created_by: context.userId,
        is_active: data.active,
        team_code: teamCode,
      },
      { onConflict: "id" },
    );

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: data.role }, { onConflict: "user_id,role" });

    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "team_member_created",
      label: `${data.full_name} (${data.email}) - Code: ${teamCode}`,
    });

    return {
      id: created.user.id,
      email: data.email,
      full_name: data.full_name,
      team_code: teamCode,
    };
  });

export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().min(2).max(80).optional(),
        phone: z.string().max(30).optional(),
        job_title: z.string().min(2).max(60).optional(),
        avatar_url: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, job_title, ...profilePatch } = data;
    if (Object.keys(profilePatch).length) {
      await supabaseAdmin.from("profiles").update(profilePatch).eq("id", id);
    }
    if (job_title) await supabaseAdmin.from("team_members").update({ job_title }).eq("id", id);
    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "team_member_updated",
      label: data.full_name ?? "Team member updated",
    });
    return { ok: true };
  });

export const resetTeamPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "team_password_reset",
      label: "Password reset by admin",
    });
    return { ok: true };
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("requests")
      .update({ assigned_team_id: null })
      .eq("assigned_team_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "team_member_deleted",
      label: "Team member removed",
    });
    return { ok: true };
  });

export const setTeamMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_members").update({ is_active: data.active }).eq("id", data.id);
    await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.id);
    return { ok: true };
  });

/** Suspend / activate an end user. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.id);
    await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.active ? "none" : "876000h",
    });
    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: data.active ? "user_activated" : "user_suspended",
      label: data.active ? "User activated" : "User suspended",
    });
    return { ok: true };
  });

/** Assign or transfer a request to a team member. */
export const assignRequestToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        team_member_id: z.string().uuid().nullable().optional(),
        reason: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: before } = await supabaseAdmin
      .from("requests")
      .select("assigned_team_id, reference, title, user_id")
      .eq("id", data.request_id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("requests")
      .update({
        assigned_team_id: data.team_member_id || null,
        status: (data.team_member_id ? "assigned" : before?.status || "pending") as any,
        assigned_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", data.request_id);

    if (error) {
      if (error.message.includes("tuple to be updated was already modified")) {
        // Retry once if it was a transient trigger conflict
        const { error: retryError } = await supabaseAdmin
          .from("requests")
          .update({
            assigned_team_id: data.team_member_id || null,
            status: (data.team_member_id ? "assigned" : before?.status || "pending") as any,
            assigned_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", data.request_id);
        if (retryError)
          throw new Error(`Conflict: ${retryError.message}. Please refresh and try again.`);
      } else {
        throw new Error(error.message);
      }
    }

    const previous = before?.assigned_team_id ?? null;
    if (previous && previous !== data.team_member_id) {
      const { data: room } = await supabaseAdmin
        .from("chat_rooms")
        .select("id")
        .eq("request_id", data.request_id)
        .maybeSingle();
      await supabaseAdmin.from("notifications").insert({
        receiver_id: previous,
        role: "team",
        type: "assignment",
        title: "Request transferred away",
        body: data.reason
          ? `${before?.reference ?? ""} — ${data.reason}`
          : (before?.reference ?? "Request transferred"),
        request_id: data.request_id,
        chat_room_id: room?.id ?? null,
      });
      await supabaseAdmin.from("activity_logs").insert({
        request_id: data.request_id,
        actor_id: context.userId,
        actor_role: "admin",
        action: "request_transferred",
        label: data.reason ? `Transferred: ${data.reason}` : "Request transferred",
      });
    }

    return { ok: true };
  });

/** Master notification centre — admins see every notification in the system. */
export const listAllNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(300).default(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Broadcast an announcement notification to users, team, or everyone. */
export const broadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        audience: z.enum(["user", "team", "all"]),
        title: z.string().min(2).max(120),
        body: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const roles = data.audience === "all" ? ["user", "team"] : [data.audience];
    const { data: receivers, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", roles as ("user" | "team")[]);
    if (error) throw new Error(error.message);

    const rows = (receivers ?? []).map((r: any) => ({
      receiver_id: r.user_id,
      role: r.role,
      type: "announcement",
      title: data.title,
      body: data.body ?? null,
    }));
    if (rows.length) {
      const { error: insertError } = await supabaseAdmin.from("notifications").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "notification_broadcast",
      label: `${data.title} → ${data.audience} (${rows.length})`,
    });

    return { sent: rows.length };
  });

/** Delete a document (storage object + row). Admin only. */
export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("storage_path, file_name, request_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");

    await supabaseAdmin.storage.from("request-documents").remove([doc.storage_path]);
    await supabaseAdmin
      .from("messages")
      .update({ attachment_id: null })
      .eq("attachment_id", data.id);
    const { error } = await supabaseAdmin.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_logs").insert({
      request_id: doc.request_id,
      actor_id: context.userId,
      actor_role: "admin",
      action: "document_deleted",
      label: `Document deleted: ${doc.file_name}`,
    });
    return { ok: true };
  });

/** Records an admin download so the activity log stays complete. */
export const logAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        action: z.string().min(2).max(60),
        label: z.string().max(200).optional(),
        request_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_logs").insert({
      request_id: data.request_id ?? null,
      actor_id: context.userId,
      actor_role: "admin",
      action: data.action,
      label: data.label ?? null,
    });
    return { ok: true };
  });

/** Team Code Verification -> for Team Login */
export const verifyTeamCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ code: z.string().min(4) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verify the authenticated user is a team member
    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .select("id, team_code, is_active")
      .eq("id", context.userId)
      .maybeSingle();

    if (error || !member) {
      throw new Error("This account is not provisioned as a Team Member.");
    }

    if (!member.is_active) {
      throw new Error("This team account has been suspended.");
    }

    // 2. Verify the provided code matches the assigned team code
    const expectedClean = member.team_code.trim().toUpperCase();
    const providedClean = data.code.trim().toUpperCase();

    if (expectedClean !== providedClean) {
      throw new Error("Invalid team code.");
    }

    // 3. Verify user role explicitly for defense in depth
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (roleData?.role !== "team" && roleData?.role !== "admin") {
      throw new Error("This account does not have team privileges.");
    }

    return {
      ok: true,
      id: member.id,
    };
  });

// ─── Phase 6C: Super Admin Takeover ──────────────────────────────────────────
export const takeoverRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ request_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await supabase.rpc("takeover_request", {
      req_id: data.request_id,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export interface AdminAnalyticsStats {
  total: number;
  completed: number;
  avgCompletion: number;
  avgResponse: number;
  daily: number;
  weekly: number;
  monthly: number;
  users: number;
  teamCount: number;
  docsCount: number;
  perTeam: Array<{
    id: string;
    name: string;
    total: number;
    done: number;
    isOnline: boolean;
  }>;
  topUsers: Array<{
    id: string;
    count: number;
  }>;
  topDocs: Array<{
    id: string;
    count: number;
  }>;
}

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    // @ts-ignore - type generation pending
    const { data, error } = await (supabase.rpc as any)("get_admin_analytics");
    if (error) throw new Error(error.message);

    return data as unknown as AdminAnalyticsStats;
  });
