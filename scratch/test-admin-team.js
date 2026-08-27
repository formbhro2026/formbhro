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

  const { data: team, error: teamErr } = await supabase.from("team_members").select("*");
  if (teamErr) return console.error("Team error:", teamErr);
  console.log("Team members:", team.length);

  if (team.length > 0) {
    const target = team[0];
    console.log("Trying to update team member:", target.id);
    const { data: updated, error: updErr } = await supabase
      .from("team_members")
      .update({ is_active: !target.is_active })
      .eq("id", target.id)
      .select();
    if (updErr) console.error("Update error:", updErr);
    else {
      console.log("Updated team member!", updated[0].is_active);
      // revert it back
      await supabase
        .from("team_members")
        .update({ is_active: target.is_active })
        .eq("id", target.id);
    }
  }
}
test();
