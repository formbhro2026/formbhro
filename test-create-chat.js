import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@formbhro.com", // wait admin is not rate limited but still can create chat?
    password: "ADMIN@2026",
  });
  if (authErr) {
    console.error(authErr);
    return;
  }

  const { data, error } = await supabase.rpc("create_new_request_with_limit", {
    p_title: "Test Chat",
    p_category: "Government Form",
    p_priority: "medium",
  });

  if (error) {
    console.error("Failed to create chat:", error);
  } else {
    console.log("Chat created:", data);
  }
}
run();
