import { createClient } from "@supabase/supabase-js";

async function run() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@formbhro.com", // wait, we don't have the password
    password: "password",
  });
}
run();
