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
  if (error) return console.error(error);
  const reqs = await supabase.from("requests").select("*").limit(1);
  if (!reqs.data || reqs.data.length === 0) return console.log("no requests");

  const id = reqs.data[0].id;
  const { data: updated, error: updErr } = await supabase
    .from("requests")
    .update({ status: "under_review" })
    .eq("id", id)
    .select();
  console.log("Updated:", updated ? updated.length : updErr);
}
test();
