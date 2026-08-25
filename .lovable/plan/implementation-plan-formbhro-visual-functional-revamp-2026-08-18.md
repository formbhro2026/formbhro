# Implementation Plan - Formbhro Visual & Functional Revamp

This plan addresses visual text edits and functional improvements for the Formbhro platform, including the authentication page, mobile navigation, document uploading, and notification systems across all modules.

## User Improvements

### Auth Page Revamp
- Move Google sign-in to the top of the authentication form in `ModernAuthForm.tsx`.
- Refine the Google button styling to be prominent.

### Mobile Navigation & Camera Upload
- Update `MobileBottomNav.tsx` to use a `Plus` icon for the central action.
- Enhance `FillNowProvider.tsx` to support a direct camera capture flow.
- Add a naming step after capture to allow users to label documents before saving.
- Fix issues preventing documents from saving correctly in the live backend.

### User Notifications
- Verify and fix the notification bell functionality in `UserHeader.tsx`.
- Ensure the `NotificationPanel.tsx` correctly reflects unread status and displays live data.

## Team Improvements

### Team Notifications
- Fix the notification bell in `TeamHeader.tsx` to correctly toggle the `TeamNotificationPanel.tsx`.
- Ensure real-time updates for team notifications are functional.

## Admin Improvements

### Admin Console Overhaul
- **Full-Screen Chat UI**: Redesign `src/routes/admin/_shell/chats.tsx` to use the full viewport height and width, removing cramped containers.
- **Improved Navigation**: Ensure clicking a chat "enters" the conversation properly with a focus on the message thread.
- **Admin Notifications**: Implement a functional notification panel for the Admin dashboard, accessible via the bell icon in the top bar.

## Technical Details
- Use `navigator.mediaDevices.getUserMedia` or standard `input[type="file"]` with `capture="environment"` for mobile camera access.
- Update `LiveUserStoreProvider.tsx` and `TeamStoreProvider.tsx` to ensure RLS policies and API calls for documents are robust.
- Standardize notification panel behavior using shared logic where possible.
