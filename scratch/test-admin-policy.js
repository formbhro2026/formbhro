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
    .from("policies")
    .insert({
      type: "terms",
      version: "1.0",
      content: "test policy",
      is_active: false,
      created_by: auth.user.id,
      published_at: new Date().toISOString(),
    })
    .select();

  if (insertErr) {
    console.error("Insert error:", insertErr);
  } else {
    console.log("Inserted policy:", inserted[0].id);
    await supabase.from("policies").delete().eq("id", inserted[0].id);
  }
}
test();
