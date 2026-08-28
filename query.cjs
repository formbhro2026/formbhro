const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key =
  env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1] ||
  env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from("requests")
    .select("id, reference, assigned_team_id, user_id")
    .limit(10);
  console.log(data);
}
run();
