import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@formbhro.com",
    password: "ADMIN@2026",
  });
  if (authErr) {
    console.error("Login failed:", authErr);
    return;
  }
  console.log("Logged in Admin:", auth.user.id);

  const { data: reqs, error: reqErr } = await supabase
    .from("requests")
    .select("id, user_id")
    .limit(1);
  if (reqErr || !reqs || reqs.length === 0) {
    console.error("Could not fetch requests:", reqErr);
    return;
  }

  const req = reqs[0];
  console.log("Found request:", req.id);

  const { data: rooms, error: roomErr } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("request_id", req.id)
    .single();
  if (roomErr || !rooms) {
    console.error("Could not fetch chat room:", roomErr);
    return;
  }

  const room = rooms;
  console.log("Found room:", room.id);

  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({
      chat_room_id: room.id,
      request_id: req.id,
      sender_id: auth.user.id,
      sender_role: "admin",
      body: "Test message from admin!",
      is_system: false,
    })
    .select()
    .single();

  if (msgErr) {
    console.error("Message send failed:", msgErr);
  } else {
    console.log("Message sent:", msg.id);
  }
}
run();
