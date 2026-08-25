# Plan: Team Code Auth System

Implement a specialized "Team Code" authentication flow for team members, moving away from email/password for the Team Panel while maintaining it for Admin.

## Database Changes
- Add `team_code` column to `public.team_members` table (unique, not null).
- Remove existing team member accounts (wipe `team_members` and associated `auth.users` via migration or admin functions).
- Update RLS and triggers to support team code verification.

## Backend Logic (Server Functions)
- Update `createTeamMember` in `src/lib/api/admin.functions.ts` to generate a unique 6-8 digit `team_code`.
- Create a new `verifyTeamCode` server function that takes a code, verifies it against `team_members`, and establishes a Supabase session (or returns a token).

## Frontend Components
- Create `src/routes/team/auth.tsx` as a new dedicated team authentication page.
- Replace the email/password fields in `src/routes/team/login.tsx` with a single "Team Code" input.
- Update `AdminTeam` view in `src/routes/admin/_shell/team.tsx` to display the generated `team_code` for each member.

## Technical Details
- **Team Code Generation**: Random alphanumeric or numeric string (e.g., `FBH-123456`).
- **Auth Flow**: 
    1. Admin creates team member -> Code generated.
    2. Team member enters code on `/team/auth`.
    3. Backend verifies code and returns session.
- **Privacy**: Team codes should be treated as sensitive; only Admins can see them.
