import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
async function test() {
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: "admin@formbhro.com",
    password: "ADMIN@2026",
  });
  if (error) return console.error("Auth error:", error);
  console.log("Logged in as admin:", auth.user.id);

  // Get a chat room
  const { data: reqs } = await supabase.from("requests").select("*").limit(1);
  if (!reqs || reqs.length === 0) return console.log("No requests");
  const req = reqs[0];

  console.log("Fetching chat room for request:", req.id);
  const { data: room, error: roomErr } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("request_id", req.id)
    .maybeSingle();
  if (roomErr) return console.error("Room error:", roomErr);
  console.log("Room:", room?.id);

  if (room) {
    const { data: msgs, error: msgsErr } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_room_id", room.id);
    if (msgsErr) return console.error("Messages error:", msgsErr);
    console.log("Messages count:", msgs.length);

    // Try to send a message
    console.log("Sending a message...");
    const { data: sent, error: sendErr } = await supabase
      .from("messages")
      .insert({
        chat_room_id: room.id,
        request_id: req.id,
        sender_id: auth.user.id,
        sender_role: "admin",
        body: "Hello from admin test",
      })
      .select();

    if (sendErr) console.error("Send error:", sendErr);
    else console.log("Sent message:", sent[0].id);
  }
}
test();
