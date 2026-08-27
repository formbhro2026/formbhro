import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@formbhro.com",
    password: "ADMIN@2026",
  });
  if (authErr) {
    console.error("Login failed:", authErr);
    return;
  }
  console.log("Logged in:", auth.user.id);

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .update({
      phone: "1234567890",
    })
    .eq("id", auth.user.id)
    .select()
    .single();

  if (profErr) {
    console.error("Profile update failed:", profErr);
  } else {
    console.log("Profile updated:", profile);
  }
}
run();
