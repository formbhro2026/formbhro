# Plan: Fix Admin Request Assignment Conflict

Resolve the "tuple to be updated was already modified" error in the request assignment flow by centralizing the update logic and handling potential RLS/trigger side effects.

## Proposed Changes

### Backend Logic
- **`src/lib/api/admin.functions.ts`**:
  - Refactor `assignRequestToTeam` to use a single `supabaseAdmin.from("requests").update(...)` call.
  - Consolidate all fields (assigned_team_id, status, assigned_at, last_activity_at) into this one call.
  - Add explicit error handling for the "already modified" conflict, providing a clearer user-facing message or implementing a retry if appropriate.
  - Ensure `last_activity_at` is updated to trigger realtime refreshes correctly.

### Technical Details
- The error `tuple to be updated was already modified` usually occurs in PostgreSQL when two concurrent transactions try to update the same row, or when a trigger modifies the row in a way that conflicts with the primary update.
- By moving to a single update call, we reduce the transaction surface area.
- I will also verify if there are any conflicting database triggers on the `requests` table.

## Constraints & Considerations
- Maintain existing RLS security by ensuring the admin's identity is verified before using the service role client.
- Ensure realtime listeners in the Admin Panel correctly pick up the state change.
