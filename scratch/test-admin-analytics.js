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
  console.log("Logged in:", auth.user.id);

  const { data, error: rpcErr } = await supabase.rpc("get_admin_analytics");
  if (rpcErr) {
    console.error("RPC Error:", rpcErr);
  } else {
    console.log("Stats:", data);
  }
}
test();
