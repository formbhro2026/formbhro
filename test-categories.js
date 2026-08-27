import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

async function run() {
  const { data, error } = await supabase.from("categories").select("*");
  console.log("Categories:", data);
}
run();
