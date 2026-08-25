# Plan: User Dashboard Revamp (Phase 2 Alignment)

Align the User Dashboard (`/app`) and Shell UI with the reference image (user-uploads://file-17), ensuring a clean, mobile-optimized light theme while retaining core functionality like "Fill Now".

## Proposed Changes

### Theme & Global Styles
- Adjust `--color-bg` and other tokens in `src/styles.css` to ensure they default to a clean white/gray light theme for the app shell, keeping the dark landing page separate.
- Ensure text contrast is high (text-gray-900 for headings, text-gray-500 for secondary).

### Shell Layout (`src/routes/app.tsx`, `src/components/layout/UserHeader.tsx`, `UserSidebar.tsx`)
- Update `UserHeader.tsx` to match the reference:
  - Sidebar toggle on the left.
  - Centered brand logo.
  - Notification icon with badge on the right.
- Ensure consistent padding and sticky positioning.

### Dashboard Content (`src/components/dashboard/MobileDashboard.tsx`)
- **Carousel Banner**: Recreate the "Latest Government Job Updates" banner with a blue background, clipboard/megaphone illustration (Lucide icons + CSS), and pagination dots.
- **Explore Categories**:
  - Replace current list with a 2x2 or 4x1 grid of category cards.
  - Categories: Jobs Notifications, Online Forms, Admit Cards, Results.
  - Add the **"Fill Now"** button as a primary action, possibly as a floating action or a prominent card above the categories to ensure it stands out.
- **Recent Updates**:
  - Implement the list view from the reference image.
  - Each item: Icon (green briefcase, blue file, purple graduation cap), Title, Action text (Apply Online, Download Now), and a chevron right.
  - Maintain real data integration with fallback mock items.

### Technical Details
- Use `lucide-react` for all iconography.
- Implement responsive grid layouts using Tailwind (grid-cols-4 for desktop, grid-cols-2 or horizontal scroll for mobile).
- Retain the `useUserStore` and `useFillNow` logic for functional integration.

## Constraints & Considerations
- Keep the landing page dark theme intact (CSS scoping or local overrides).
- Ensure "Fill Now" remains the most accessible action for the user's primary workflow.
- Mobile-first approach as per the reference image.
