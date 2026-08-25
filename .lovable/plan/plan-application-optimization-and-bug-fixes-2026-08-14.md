# Plan - Application Optimization and Bug Fixes

Optimize performance and responsiveness of Formbhro while fixing identified bugs across the Landing Page and User Module.

## Performance & Speed Optimizations
- **Image Optimization**: Replace local asset imports in components like `SplashScreen.tsx`, `UserSidebar.tsx`, and `UserHeader.tsx` with optimized image loading strategies or confirm assets are served via CDN/Edge.
- **Render Optimization**: Use `content-visibility: auto` more broadly for large lists like `ChatList` and `RecentRequests` to reduce initial layout cost.
- **Hydration Speed**: Refactor `LiveUserStoreProvider` to fetch data in parallel rather than sequentially in the `hydrate` loop.
- **Bundle Optimization**: Ensure Lucide icons are imported from the ESM entry point to allow tree-shaking (already largely followed, but verify).

## Responsiveness & UX
- **Desktop Sidebar**: Fix the logo visibility and contrast on the desktop sidebar which currently feels slightly disconnected from the "premium dark" aesthetic.
- **Mobile Header**: Adjust `UserHeader` to remove the brightness filter that makes the logo appear white on mobile while keeping it original on desktop.
- **Mobile Chat**: Add `pb-[env(safe-area-inset-bottom)]` to `MessageComposer` and `MobileBottomNav` to handle gesture bars on iOS/Android correctly.
- **WhatsApp UI Refinement**: Adjust `MessageBubble` padding and font sizes slightly to match WhatsApp's "compact yet readable" feel on smaller screens.

## Bug Fixes
- **Live Sync Hydration**: Fix potential race condition in `LiveUserStoreProvider` where messages could be duplicated if a realtime message arrives during initial fetch.
- **OTP Mock Stability**: Ensure the mock OTP receipt simulation in `ModernAuthForm.tsx` is robust and handles corner cases like rapid clicking.
- **A11y**: Add missing `aria-label` to various icon-only buttons in the Chat interface and Admin panel.

## Technical Details
- **Store Refactor**:
  ```typescript
  // Example hydration improvement
  const [requests, messages, docs] = await Promise.all([
    requestsApi.listRequests(),
    messagesApi.listRecentMessages(),
    documentsApi.listRecentDocuments()
  ]);
  ```
- **CSS Improvements**:
  - Add `safe-area-inset` support to global layout containers.
  - Implement `will-change: transform` on animated elements like the splash screen loader.
