# Plan: Chat Reliability, Automatic Assignment, and UX Enhancements

Fix chat synchronization issues, implement automatic team assignment on message send, enhance the document upload flow, and refine the WebRTC call stability.

## User Review Required

- **Chat Status**: I'm consolidating chat statuses to: `Unassigned`, `Assigned`, and `Completed`.
- **Assignment Logic**: Team members will now automatically claim a request simply by sending a message in its chat.

## Technical Details

### 1. Chat Reliability & Real-time Sync

- **Fix "Room Unavailable"**: Ensure `LiveTeamStore` properly hydrates the `rooms` map for all accessible requests, including the unassigned pool.
- **Instant Messaging**: Optimize optimistic UI in `sendMessage` to show bubbles immediately.
- **Mark as Read**: Ensure `markRead` correctly updates the `seen` status in the DB and reflects instantly on the sender's side with double accent ticks.

### 2. Team Panel & Automatic Assignment

- **Auto-Assignment**: Modify `TeamStore.sendMessage` to trigger a self-assignment call if the request is currently unassigned.
- **Status Management**: Standardize on `Unassigned` (pool), `Assigned` (active), and `Completed` (history).
- **In-Chat Documents**: Move "Documents" from a separate side-module to a top-level context panel within the chat view for team members, ensuring quick access to user files.

### 3. User Experience Refinements

- **Fill Now Redirection**: Change the "Fill Now" button in the sidebar/bottom nav to open the chat list or a new chat creation flow rather than the camera directly. The `+` icon remains the dedicated camera trigger.
- **Document Naming & Saving**: Fix the multi-document capture flow to ensure names are captured correctly and files are persisted to Supabase Storage.
- **Camera Save Loop**: Ensure the "File name" box appears post-capture and successfully saves the document to the backend.

### 4. WebRTC Call Stability

- **Signaling Robustness**: Improve error handling in the signaling layer (`webrtc.ts`) to handle transient disconnects.
- **Media Stream Handling**: Ensure video/audio tracks are correctly attached and cleaned up on hangup.

### 5. Responsiveness

- **Mobile UI**: Audit and fix layout overflows in the chat and document list views on small screens.
- **Admin Full-Screen Chat**: Ensure the admin chat console is truly immersive on all screen sizes.

## Files to Modify

- `src/lib/team-store.tsx`: Implementation of auto-assignment and pool room hydration.
- `src/lib/live-user-store.tsx`: Optimization of optimistic message states.
- `src/components/layout/FillNowProvider.tsx`: Document naming and saving logic fixes.
- `src/components/layout/UserSidebar.tsx`: "Fill Now" navigation update.
- `src/components/layout/MobileBottomNav.tsx`: "Fill Now" navigation update.
- `src/routes/team/_shell/work.tsx`: UI changes for document access and pool management.
- `src/lib/api/messages.ts`: Ensure `seen` status triggers realtime updates reliably.
- `src/lib/api/requests.ts`: Add `selfAssign` helper.
