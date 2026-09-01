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
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired. Please sign in again.", "unauthenticated");

  // 1. Try to find an existing direct chat request for this team member
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

  // 2. If not found, create one
  if (!request) {
    const title = `Direct Chat · ${teamMemberName || "Team Member"}`;
    const ref = `ADM-TM-${Math.floor(1000 + Math.random() * 9000)}`;

    const isCurrentTeamMember = uid === teamMemberId;

    if (isCurrentTeamMember) {
      // Team member creating a direct report chat
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
    } else {
      // Admin initiating direct chat with team member
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

      // Assign the team member to this request
      const { data: updatedReq, error: assignErr } = await supabase
        .from("requests")
        .update({ assigned_team_id: teamMemberId, assigned_at: new Date().toISOString() })
        .eq("id", createdReq.id)
        .select()
        .single();

      request = (updatedReq || createdReq) as RequestRow;
    }
  }

  // 3. Ensure chat room exists
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
