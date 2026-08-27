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

  const { data: cats, error: catsErr } = await supabase.from("categories").select("*").limit(1);
  console.log("Categories:", cats ? cats.length : catsErr);

  console.log("Testing insert...");
  const { data: inserted, error: insertErr } = await supabase
    .from("categories")
    .insert({
      name: "Test category from admin",
      description: "Test",
      is_active: true,
    })
    .select();

  if (insertErr) {
    console.error("Insert error:", insertErr);
  } else {
    console.log("Inserted category:", inserted[0].id);
    await supabase.from("categories").delete().eq("id", inserted[0].id);
  }
}
test();
