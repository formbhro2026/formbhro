import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

async function run() {
  const email = `testuser_${Date.now()}@formbhro.com`;
  const { data: auth, error: authErr } = await supabase.auth.signUp({
    email,
    password: "PASSWORD_HERE",
    options: { data: { full_name: "Test User" } },
  });
  if (authErr) {
    console.error("Signup failed:", authErr);
    return;
  }
  console.log("Logged in User:", auth.user.id);

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .update({
      phone: "0987654321",
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
