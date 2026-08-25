-- Add team_code to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS team_code TEXT UNIQUE;

-- Remove all existing team members from team_members table as requested
TRUNCATE TABLE public.team_members CASCADE;

-- Ensure team_code is not null for future entries
ALTER TABLE public.team_members ALTER COLUMN team_code SET NOT NULL;
