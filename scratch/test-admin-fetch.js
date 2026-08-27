import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin@formbhro.com",
    password: "ADMIN@2026",
  });
  if (error) {
    console.error("Login failed:", error);
    return;
  }
  const { data: reqs, error: reqErr } = await supabase.from("requests").select("*").limit(5);
  console.log("Requests:", reqs ? reqs.length : reqErr);
  const { data: team, error: teamErr } = await supabase.from("team_members").select("*");
  console.log("Team members:", team ? team.length : teamErr);
}
test();
