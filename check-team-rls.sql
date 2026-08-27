SELECT pol.policyname, pol.permissive, pol.roles, pol.cmd, pol.qual, pol.with_check
FROM pg_policy pol
JOIN pg_class tbl ON pol.polrelid = tbl.oid
JOIN pg_namespace nsp ON tbl.relnamespace = nsp.oid
WHERE nsp.nspname = 'public' AND tbl.relname = 'team_members';
