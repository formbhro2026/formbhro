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

  const { data: inserted, error: insertErr } = await supabase
    .from("quick_replies")
    .insert({
      title: "Test Template",
      body: "Test Template Body",
      owner_id: auth.user.id,
    })
    .select();

  if (insertErr) {
    console.error("Insert error:", insertErr);
  } else {
    console.log("Inserted template:", inserted[0].id);
    await supabase.from("quick_replies").delete().eq("id", inserted[0].id);
  }
}
test();
