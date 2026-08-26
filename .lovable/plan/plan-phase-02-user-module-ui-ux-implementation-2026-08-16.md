# Plan: Phase 02 — User Module UI/UX Implementation

Implement the complete User Module UI/UX for Formbhro, maintaining strict visual alignment with the premium dark design system (#050505 background, #FF7A00 accents).

## User Review Required

> [!IMPORTANT]
> This phase reverts the application's internal UI from the previous light mode back to the premium dark mode to match the landing page, as strictly requested.

- **Theme Reversion**: All internal dashboard screens will move from white to #050505.
- **Workflow Priority**: The "Fill Now" action will be the primary entry point, with logic to handle active requests.

## Proposed Changes

### Theme & Styling

- Update `src/styles.css` to reinstate premium dark mode tokens as global defaults.
- Ensure all components (Sidebar, Header, Cards) use these tokens consistently.

### Application Shell

- **Desktop Sidebar**: Fixed left sidebar with Formbhro logo, primary navigation, and prominent "Fill Now" action.
- **Mobile Navigation**: Top App Bar + Bottom Navigation with a central primary "Fill Now" squircle button.

### User Dashboard (Home)

- Implement "Good Morning, [Name]" greeting.
- Primary "Fill Now" card as the #1 action.
- "Active Request" card (if applicable) appearing prominently below.
- "Latest Update" snippet from recent activity.
- "Recent Requests" list and "Quick Access" grid.

### "Fill Now" Logic

- Implement check for active requests.
- Redirect to existing chat if active, or show a polished modal to handle new/existing request choice.

### Chat System

- **Chat List**: Filterable view of all active and completed requests.
- **Chat Screen**: WhatsApp-inspired messaging UI but with dark bubbles (Support: Dark Grey, User: Orange Gradient).
- **Message Composer**: Sticky bottom bar with attachment support.
- **Request Details**: Right-side panel (Desktop) or Bottom Sheet (Mobile) for metadata and document history.

### Documents & Profile

- **My Documents**: Structured grid/list of all files shared across requests.
- **Profile**: Clean management of personal info and security settings.

## Technical Details

- Use React, Tailwind CSS, and Lucide React.
- Centralized state management via `UserStore` (already existing, will be updated).
- Responsive breakpoints handled via Tailwind utility classes (320px to 1440px+).
- Transition speeds: 150ms-250ms.
