-- Migration: phase7_fixes_hardening
-- Description: Phase 7 forensic fixes:
--   1. DB CHECK constraint on availability_status
--   2. assertTeam helper on availability update is enforced via RLS (team members own their row)

-- 1. Add CHECK constraint for availability_status
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_availability_status_check
  CHECK (availability_status IN ('online', 'away', 'offline'));
