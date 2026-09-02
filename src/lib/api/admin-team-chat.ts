import { supabase } from "@/integrations/supabase/client";
import { ApiError, type RequestRow, type ChatRoomRow } from "./types";
import { getOrCreateChatRoom } from "./requests";

const DIRECT_CHAT_CATEGORY = "Team Direct Report";

/**
 * Gets or creates the direct chat thread between a team member and admin.
 */
export async function getOrCreateAdminTeamChat(
  teamMemberId: string,
  teamMemberName?: string,
): Promise<{ request: RequestRow; room: ChatRoomRow }> {
  // 1. Try invoking the secure server RPC
  try {
    const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
      "get_or_create_admin_team_chat",
      {
        p_team_member_id: teamMemberId,
        p_team_member_name: teamMemberName ?? null,
      },
    );

    if (!rpcErr && rpcData?.request && rpcData?.room) {
      return {
        request: rpcData.request as RequestRow,
        room: rpcData.room as ChatRoomRow,
      };
    }
  } catch (rpcEx) {
    console.warn("[AdminTeamChat] RPC error, falling back:", rpcEx);
  }

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id || teamMemberId;

  // 2. Query fallback: find existing direct chat request for this team member
  const { data: existingReqs, error: fetchErr } = await supabase
    .from("requests")
    .select("*")
    .eq("category", DIRECT_CHAT_CATEGORY)
    .or(`user_id.eq.${teamMemberId},assigned_team_id.eq.${teamMemberId}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchErr) {
    console.warn("Could not query existing admin-team chat:", fetchErr);
  }

  let request: RequestRow | null = existingReqs?.[0] ?? null;

  // 3. If not found, create one
  if (!request) {
    const title = `Direct Chat · ${teamMemberName || "Admin Support"}`;
    const ref = `ADM-TM-${Math.floor(1000 + Math.random() * 9000)}`;

    // Insert with assigned_team_id: null to adhere strictly to client RLS policy (assigned_team_id IS NULL)
    const { data: createdReq, error: insertErr } = await supabase
      .from("requests")
      .insert({
        user_id: uid,
        title,
        category: DIRECT_CHAT_CATEGORY,
        priority: "high",
        status: "in_progress",
        reference: ref,
      })
      .select()
      .single();

    if (insertErr) {
      throw new ApiError(insertErr.message, insertErr.code);
    }
    request = createdReq as RequestRow;

    // Self-claim if assigned_team_id is not set
    try {
      await supabase.rpc("claim_request", { req_id: request.id });
    } catch {
      // Non-fatal if already assigned or creator is admin
    }
  }

  // 4. Ensure chat room exists
  const room = await getOrCreateChatRoom(request.id);
  return { request, room };
}

/**
 * Lists all active team member direct chats for the admin panel.
 */
export async function listAdminTeamDirectChats(): Promise<RequestRow[]> {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("category", DIRECT_CHAT_CATEGORY)
    .order("last_activity_at", { ascending: false });

  if (error) throw new ApiError(error.message, error.code);
  return (data ?? []) as RequestRow[];
}
