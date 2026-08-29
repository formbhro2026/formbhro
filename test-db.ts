(globalThis as any).import = { meta: { env: { VITE_SUPABASE_URL: "https://ogjhvmucklbxcewpkiai.supabase.co", VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namh2bXVja2xieGNld3BraWFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzIzNTAsImV4cCI6MjEwMDcwODM1MH0.RksSzHe_ZYyhOT7NswqVlN52OF31lOUCJsrjmSURBRQ" } } };

import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://ogjhvmucklbxcewpkiai.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namh2bXVja2xieGNld3BraWFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTEzMjM1MCwiZXhwIjoyMTAwNzA4MzUwfQ.5GlZhJoR7Urcb6gRKPhiJ_OTh1MqJXC2Bw59pB4ZDLg");

async function test() {
  const { data } = await supabase.from('requests').select('id, status, archived, assigned_team_id, reference').limit(50);
  console.log(data);
}
test();
