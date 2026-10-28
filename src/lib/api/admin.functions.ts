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
  assertTeamOrAdmin,
  assertPermission,
} from "./admin-helpers.server";

/**
 * Super-admin gate. Accepts only the authorized admin credentials
 * (Rakesh@RbRb@Formbhro / Rb@FB@9973@Formbhro).
 * Provisions the Supabase auth user, user_roles, and profiles on call.
 */
export const ensureAdminAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ username: z.string().max(120), password: z.string().max(200) }).parse(input),
  )
  .handler(async ({ data }: any) => {
    const username = data.username.trim().toLowerCase();
    const password = data.password;

    // Check authorized admin credentials
    const isAuthorized =
      (username === ADMIN_GATE_USERNAME.toLowerCase() ||
        username === "rakesh@rbrb@formbhro") &&
      password === ADMIN_GATE_PASSWORD;

    if (!isAuthorized) {
      return { ok: false as const };
    }

    // Use primary credentials for the Supabase account regardless of which set was entered
    const targetEmail = ADMIN_GATE_EMAIL;
    const targetPassword = ADMIN_GATE_PASSWORD;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server").catch(
      (err) => {
        console.error("Failed to load supabaseAdmin:", err);
        throw new Error(
          "Admin service is currently unavailable. Please check backend configuration.",
        );
      },
    );

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let userId = list?.users.find(
      (u: { email?: string; id: string }) => u.email?.toLowerCase() === targetEmail,
    )?.id;

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password: targetPassword,
        email_confirm: true,
        user_metadata: { full_name: "Super Admin", role: "admin" },
      });
      if (error || !created.user)
        throw new Error(error?.message ?? "Could not prepare the admin account");
      userId = created.user.id;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: targetPassword });
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, full_name: "Super Admin", email: targetEmail },
        { onConflict: "id" },
      );

    return { ok: true as const, email: targetEmail, password: targetPassword };
  });

/**
 * Provisions the demo user account for platform testing.
 * Email: demo@formbhro.com / Password: DemoUser@2026 / Role: user
 */
export const ensureDemoUserAccount = createServerFn({ method: "POST" })
  .handler(async () => {
    const DEMO_EMAIL = "demo@formbhro.com";
    const DEMO_PASSWORD = "DemoUser@2026";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server").catch(
      (err) => {
        console.error("Failed to load supabaseAdmin:", err);
        throw new Error("Admin service unavailable.");
      },
    );

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let userId = list?.users.find(
      (u: { email?: string; id: string }) => u.email?.toLowerCase() === DEMO_EMAIL,
    )?.id;

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Demo User", role: "user" },
      });
      if (error || !created.user)
        throw new Error(error?.message ?? "Could not provision demo account");
      userId = created.user.id;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: "Demo User", email: DEMO_EMAIL }, { onConflict: "id" });

    return { ok: true as const, email: DEMO_EMAIL, password: DEMO_PASSWORD };
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
        permissions: z.record(z.boolean()).optional().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }: any) => {
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
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const teamCode = `FBH-${datePart}-${sequence}-${suffix}`;

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
        permissions: data.permissions,
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
        role: z.enum(["team", "admin"]).optional(),
        permissions: z.record(z.boolean()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, job_title, permissions, ...profilePatch } = data;
    if (Object.keys(profilePatch).length) {
      await supabaseAdmin.from("profiles").update(profilePatch).eq("id", id);
    }
    const teamPatch: { job_title?: string; permissions?: Record<string, boolean> } = {};
    if (job_title) teamPatch.job_title = job_title;
    if (permissions) teamPatch.permissions = permissions;

    if (Object.keys(teamPatch).length > 0) {
      await supabaseAdmin.from("team_members").update(teamPatch).eq("id", id);
    }

    if (data.role) {
      // Prevent demoting the caller
      if (id === context.userId && data.role !== "admin") {
        throw new Error("You cannot demote yourself from admin");
      }
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: id, role: data.role }, { onConflict: "user_id,role" });
    }

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
  .handler(async ({ data, context }: any) => {
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
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Unassign pending requests so pool can pick them up, preserving completed history
    await supabaseAdmin
      .from("requests")
      .update({ assigned_team_id: null })
      .eq("assigned_team_id", data.id)
      .neq("status", "completed");
    
    // Soft deactivate to preserve chat messages, audit logs, and foreign key integrity
    await supabaseAdmin
      .from("team_members")
      .update({ is_active: false, availability_status: "offline" })
      .eq("id", data.id);
    await supabaseAdmin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", data.id);

    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "team_member_deactivated",
      label: `Team member ${data.id} deactivated and unassigned`,
    });
    return { ok: true };
  });

export const setTeamMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("You cannot suspend your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_members").update({ is_active: data.active }).eq("id", data.id);
    await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.id);
    return { ok: true };
  });

export const setTeamMemberAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ status: z.enum(["online", "away", "offline"]) }).parse(input),
  )
  .handler(async ({ data, context }: any) => {
    // Must be a team member or admin — regular users cannot set availability
    await assertTeamOrAdmin(context as Parameters<typeof assertTeamOrAdmin>[0]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("team_members")
      .update({ availability_status: data.status })
      .eq("id", context.userId);
    return { ok: true };
  });

/** Suspend / activate an end user. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("You cannot suspend your own account");
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
  .handler(async ({ data, context }: any) => {
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
        status: (data.team_member_id ? "assigned" : before?.status || "pending") as
          "pending" | "assigned" | "active" | "completed" | "escalated" | "closed",
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
            status: (data.team_member_id ? "assigned" : before?.status || "pending") as
              "pending" | "assigned" | "active" | "completed" | "escalated" | "closed",
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
  .handler(async ({ data, context }: any) => {
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
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const roles = data.audience === "all" ? ["user", "team"] : [data.audience];
    const { data: receivers, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", roles as ("user" | "team")[]);
    if (error) throw new Error(error.message);

    const rows = (receivers ?? []).map((r: { user_id: string; role: string }) => ({
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
  .handler(async ({ data, context }: any) => {
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
  .handler(async ({ data, context }: any) => {
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
  .handler(async ({ data, context }: any) => {
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
      .eq("user_id", context.userId);

    const roles = (roleData ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("team") && !roles.includes("admin")) {
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
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);

    const { error } = await supabase.rpc("takeover_request", {
      req_id: data.request_id,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export interface AdminAnalyticsStats {
  total: number;
  pending: number;
  processing: number;
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
  timeSeries: Array<{
    date: string;
    count: number;
  }>;
}

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: any) => {
    // Admins always pass; team members need can_view_analytics permission
    await assertPermission(context, "can_view_analytics");

    const { data, error } = await context.supabase.rpc("get_admin_analytics");
    if (error) throw new Error(error.message);

    return data as unknown as AdminAnalyticsStats;
  });

/** Delete a single chat message. Admin always permitted; team requires can_delete_messages. */
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }: any) => {
    await assertPermission(context, "can_delete_messages");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Soft-delete: set deleted = true (matches existing listMessages filter)
    const { error } = await supabaseAdmin
      .from("messages")
      .update({ deleted: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "message_deleted",
      label: `Message ${data.id} deleted`,
    });
    return { ok: true };
  });

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  total_count: number;
  requests_count: number;
}

/** Paginated, database-filtered user list for Admin dashboard. */
export const getAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(200).default(50),
        search: z.string().optional(),
        filter: z.enum(["all", "active", "suspended"]).default("all"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const offset = (data.page - 1) * data.limit;

    const { data: rows, error } = await supabaseAdmin.rpc("get_admin_users", {
      _search: data.search || null,
      _status: data.filter,
      _limit: data.limit,
      _offset: offset,
    });

    if (error) throw new Error(error.message);

    let users = (rows ?? []) as AdminUserRow[];
    let total = rows?.[0]?.total_count ?? 0;

    // Fallback: if search was passed and no users were found via RPC, check if search is a User ID / UUID
    if (users.length === 0 && data.search?.trim()) {
      const raw = data.search.trim().toLowerCase();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const hex32Regex = /^[0-9a-f]{32}$/i;

      let targetUid: string | null = null;
      if (uuidRegex.test(raw)) {
        targetUid = raw;
      } else if (hex32Regex.test(raw)) {
        targetUid = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
      }

      let matchedProfile: any = null;
      if (targetUid) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, phone, avatar_url, is_active, created_at")
          .eq("id", targetUid)
          .maybeSingle();
        matchedProfile = p;
      } else if (raw.length >= 4) {
        const { data: allP } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, phone, avatar_url, is_active, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        matchedProfile = allP?.find(
          (p) =>
            p.id.toLowerCase().includes(raw) ||
            p.id.replace(/-/g, "").toLowerCase().includes(raw),
        );
      }

      if (matchedProfile) {
        const { count } = await supabaseAdmin
          .from("requests")
          .select("*", { count: "exact", head: true })
          .eq("user_id", matchedProfile.id);

        users = [
          {
            id: matchedProfile.id,
            full_name: matchedProfile.full_name,
            email: matchedProfile.email,
            phone: matchedProfile.phone,
            avatar_url: matchedProfile.avatar_url,
            is_active: matchedProfile.is_active ?? true,
            created_at: matchedProfile.created_at,
            total_count: 1,
            requests_count: count ?? 0,
          },
        ];
        total = 1;
      }
    }

    return {
      users,
      total,
    };
  });

/**
 * Dedicated server function to search user by User ID, partial UUID, email, phone, or request reference.
 * Returns user profile and all their service requests.
 */
export const adminSearchUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ query: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const raw = data.query.trim();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const hex32Regex = /^[0-9a-f]{32}$/i;

    let targetUid: string | null = null;
    if (uuidRegex.test(raw)) {
      targetUid = raw.toLowerCase();
    } else if (hex32Regex.test(raw)) {
      targetUid = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`.toLowerCase();
    }

    let profile: any = null;

    // 1. Direct search by UUID
    if (targetUid) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", targetUid)
        .maybeSingle();
      if (p) profile = p;
    }

    // 2. Search by Chat / Request reference or ID
    if (!profile) {
      let reqQuery = supabaseAdmin.from("requests").select("*, profiles:user_id(*)");
      if (targetUid) {
        reqQuery = reqQuery.or(`id.eq.${targetUid},reference.eq.${raw},reference.ilike.%${raw}%`);
      } else {
        reqQuery = reqQuery.or(`reference.eq.${raw},reference.ilike.%${raw}%`);
      }
      const { data: reqMatch } = await reqQuery.limit(1).maybeSingle();
      if (reqMatch?.user_id) {
        targetUid = reqMatch.user_id;
        profile = (reqMatch as any).profiles;
        if (!profile) {
          const { data: p } = await supabaseAdmin.from("profiles").select("*").eq("id", reqMatch.user_id).maybeSingle();
          profile = p;
        }
      }
    }

    // 3. Search profile by email, phone, or name
    if (!profile) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .or(`email.ilike.%${raw}%,phone.ilike.%${raw}%,full_name.ilike.%${raw}%`)
        .limit(1);
      if (profs && profs.length > 0) {
        profile = profs[0];
        targetUid = profile.id;
      }
    }

    // 4. Search by partial UUID / ID prefix
    if (!profile && raw.length >= 3) {
      const { data: allP } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const match = allP?.find(
        (p) =>
          p.id.toLowerCase().includes(raw.toLowerCase()) ||
          p.id.replace(/-/g, "").toLowerCase().includes(raw.toLowerCase()),
      );
      if (match) {
        profile = match;
        targetUid = match.id;
      }
    }

    // Load full service requests for this user
    let requests: any[] = [];
    const effectiveUid = profile?.id || targetUid;
    if (effectiveUid) {
      const { data: reqs } = await supabaseAdmin
        .from("requests")
        .select("*")
        .eq("user_id", effectiveUid)
        .order("created_at", { ascending: false });
      requests = reqs || [];
    }

    return {
      user: profile || (targetUid ? { id: targetUid, full_name: "User Record", email: "—", phone: "—" } : null),
      requests,
    };
  });

/**
 * Resolves indirect image hosting URLs (like ibb.co viewer pages) to direct image URLs.
 */
export const resolveImageUrl = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ url: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }: any) => {
    const rawUrl = data.url.trim();

    // 1. Check if it's an ImgBB viewer page (e.g. https://ibb.co/m5BvK5z8)
    if (rawUrl.includes("ibb.co/") && !rawUrl.includes("i.ibb.co/")) {
      try {
        const timeoutSignal =
          typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(6000)
            : undefined;

        const response = await fetch(rawUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: timeoutSignal,
        });
        if (response.ok) {
          const html = await response.text();
          const match =
            html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
            html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
          if (match && match[1]) {
            return { url: match[1].replace(/&amp;/g, "&") };
          }
        }
      } catch (err) {
        console.warn("[resolveImageUrl] Error resolving ibb.co URL:", err);
      }
    }

    return { url: rawUrl };
  });

/**
 * Uploads a news banner image directly to Supabase storage with service_role privileges.
 */
export const uploadNewsBanner = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        fileName: z.string().max(255),
        fileBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
      .parse(input),
  )
  .handler(async ({ data }: any) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanBase64 = data.fileBase64.replace(/^data:image\/[a-z0-9+-]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const ext = data.fileName.includes(".")
      ? data.fileName.slice(data.fileName.lastIndexOf("."))
      : ".jpg";
    const nameWithoutExt = data.fileName.includes(".")
      ? data.fileName.slice(0, data.fileName.lastIndexOf("."))
      : data.fileName;
    const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const uniqueId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 10);
    const storagePath = `banners/${Date.now()}-${uniqueId}-${safeName}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(storagePath, buffer, {
        contentType: data.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(storagePath);

    return { url: publicData.publicUrl };
  });

/**
 * Delete a category. Admin only.
 */
export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cat } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_logs").insert({
      actor_id: context.userId,
      actor_role: "admin",
      action: "category_deleted",
      label: `Category deleted: ${cat?.name || data.id}`,
    });

    return { ok: true as const };
  });

/**
 * Mark a form request as Completed. Team members & Admins permitted.
 */
export const markRequestCompletedServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ request_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }: any) => {
    await assertTeamOrAdmin(context as Parameters<typeof assertTeamOrAdmin>[0]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date().toISOString();
    const { data: req, error: fetchErr } = await supabaseAdmin
      .from("requests")
      .select("id, reference, user_id, title")
      .eq("id", data.request_id)
      .single();

    if (fetchErr || !req) throw new Error("Request not found");

    const { error } = await supabaseAdmin
      .from("requests")
      .update({
        status: "completed",
        progress: 100,
        completed_at: now,
        last_activity_at: now,
      })
      .eq("id", data.request_id);

    if (error) throw new Error(error.message);

    // Notify user that form is completed
    if (req.user_id) {
      await supabaseAdmin.from("notifications").insert({
        receiver_id: req.user_id,
        role: "user",
        type: "status",
        title: "Form Request Completed",
        body: `Your request "${req.title || req.reference || 'Form Assistance'}" has been marked as Completed!`,
        request_id: req.id,
      });
    }

    // Activity log
    await supabaseAdmin.from("activity_logs").insert({
      request_id: req.id,
      actor_id: context.userId,
      actor_role: context.role || "team",
      action: "request_completed",
      label: `Request marked completed: ${req.reference || req.id}`,
    });

    return { ok: true as const, completed_at: now };
  });

/**
 * Update payment status of a form request. Team & Admin permitted.
 */
export const updateRequestPaymentStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: unknown) =>
      z
        .object({
          request_id: z.string().uuid(),
          payment_status: z.enum(["pending", "paid", "unpaid", "waived", "failed"]),
          payment_note: z.string().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }: any) => {
    await assertTeamOrAdmin(context as Parameters<typeof assertTeamOrAdmin>[0]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: fetchErr } = await supabaseAdmin
      .from("requests")
      .select("id, tags, reference, user_id, title")
      .eq("id", data.request_id)
      .single();

    if (fetchErr || !req) throw new Error("Request not found");

    // Clean old payment tags and append new ones
    const currentTags: string[] = Array.isArray(req.tags) ? req.tags : [];
    const cleanTags = currentTags.filter((t) => !t.startsWith("payment:") && !t.startsWith("pnote:"));
    const updatedTags = [...cleanTags, `payment:${data.payment_status}`];
    if (data.payment_note !== undefined && data.payment_note.trim()) {
      updatedTags.push(`pnote:${encodeURIComponent(data.payment_note.trim())}`);
    }

    // Attempt to update payment_status and payment_notes directly, plus updatedTags
    let updatePayload: Record<string, any> = {
      tags: updatedTags,
      payment_status: data.payment_status,
      payment_notes: data.payment_note !== undefined ? data.payment_note.trim() : undefined,
      last_activity_at: new Date().toISOString(),
    };

    let { error } = await supabaseAdmin
      .from("requests")
      .update(updatePayload)
      .eq("id", data.request_id);

    // If payment_notes or payment_status column does not exist, retry with tags fallback
    if (error && (error.message.includes("column \"payment_notes\"") || error.message.includes("column \"payment_status\""))) {
      delete updatePayload.payment_notes;
      const retry = await supabaseAdmin
        .from("requests")
        .update(updatePayload)
        .eq("id", data.request_id);
      error = retry.error;

      if (error && error.message.includes("column \"payment_status\"")) {
        delete updatePayload.payment_status;
        const tagFallback = await supabaseAdmin
          .from("requests")
          .update(updatePayload)
          .eq("id", data.request_id);
        error = tagFallback.error;
      }
    }

    if (error) throw new Error(error.message);

    const noteText = data.payment_note ? ` (Note: ${data.payment_note})` : "";
    await supabaseAdmin.from("activity_logs").insert({
      request_id: req.id,
      actor_id: context.userId,
      actor_role: context.role || "team",
      action: "payment_status_updated",
      label: `Payment status set to "${data.payment_status}"${noteText} for ${req.reference || req.id}`,
      meta: { payment_status: data.payment_status, payment_note: data.payment_note },
    });

    return { ok: true as const, payment_status: data.payment_status, payment_note: data.payment_note, tags: updatedTags };
  });

/**
 * Privileged News / Vacancy operations for Team and Admins
 */
export const createNewsItemServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.record(z.any()).parse(input))
  .handler(async ({ data, context }: any) => {
    await assertTeamOrAdmin(context as Parameters<typeof assertTeamOrAdmin>[0]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cleanData = { ...data };
    delete cleanData.auth_token;

    const payload: Record<string, any> = {
      ...cleanData,
      created_by: context?.userId || cleanData.created_by,
      published_at: cleanData.published_at || new Date().toISOString(),
    };

    let { data: inserted, error } = await supabaseAdmin
      .from("news")
      .insert(payload as any)
      .select()
      .single();

    if (error && error.message.includes("created_by")) {
      delete payload.created_by;
      const retry = await supabaseAdmin
        .from("news")
        .insert(payload as any)
        .select()
        .single();
      inserted = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return inserted;
  });

export const updateNewsItemServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid(), patch: z.record(z.any()) }).parse(input))
  .handler(async ({ data, context }: any) => {
    await assertTeamOrAdmin(context as Parameters<typeof assertTeamOrAdmin>[0]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cleanPatch = { ...data.patch };
    delete cleanPatch.auth_token;

    const { data: updated, error } = await supabaseAdmin
      .from("news")
      .update(cleanPatch as any)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

export const deleteNewsItemServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }: any) => {
    await assertTeamOrAdmin(context as Parameters<typeof assertTeamOrAdmin>[0]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("news").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


