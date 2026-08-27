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
  const role = await supabase.from("user_roles").select("*").eq("user_id", data.user.id);
  console.log("Role:", role.data);
}
test();
