import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", "68e5b849-8723-4dc8-8679-037f838d6dbc");
  console.log("Roles for 68e5b849-8723-4dc8-8679-037f838d6dbc:", roles);
}
test();
