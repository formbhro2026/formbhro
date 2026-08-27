require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("Error:", error);
  console.log("Data:", data);
}

main();
