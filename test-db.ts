import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    return;
  }
  const { data } = await supabase.from("requests").select("id, status, archived, assigned_team_id, reference").limit(50);
  console.log(data);
}
test();
