import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "ananya.mishra@gmail.com", // wait, do I know their email?
    password: "PASSWORD_HERE",
  });
}
run();
