import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
async function test() {
  const { data, error } = await supabase.rpc("query_sql", {
    query:
      "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'policies_type_check'",
  });
  // Actually, we can't do arbitrary SQL in RPC unless there is a generic function. Let's just try inserting something else.
  // policies_type_check: CHECK (type = ANY (ARRAY['terms_of_service'::text, 'privacy_policy'::text, 'cookie_policy'::text, 'community_guidelines'::text])) maybe?
}
test();
