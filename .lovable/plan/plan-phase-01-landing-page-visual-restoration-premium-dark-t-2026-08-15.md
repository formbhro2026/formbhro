# Plan - Phase 01: Landing Page Visual Restoration (Premium Dark Theme)

Restore the Formbhro landing page to its original, approved high-fidelity dark theme as per the reference design specification.

## User Review Required

> [!IMPORTANT]
> This plan will revert the **landing page** to a dark theme while keeping the **app dashboard** and **user module** in the light theme as per your previous requests.

- **Design Conflict**: The landing page was recently moved to a light theme, but the current request specifies a return to the "APPROVED VISUAL REFERENCE" which is a premium dark theme (#050505 background with orange #FF7A00 accents).
- **Branding**: Using the original logo with black background and orange accents as the source of truth for the palette.

## Proposed Changes

### 1. Global Styles & Theme Restoration
- Update `src/styles.css` to define a separate set of theme tokens for the landing page or restore global dark tokens if they don't conflict with the app (will use a scoped approach or separate container classes).
- **Palette**:
  - Primary BG: `#050505`
  - Secondary BG: `#0A0A0A`, `#101010`
  - Accent: `#FF7A00` (Orange)
  - Text: Primary `#FFFFFF`, Secondary `#A3A3A3`, Muted `#737373`
  - Borders: `rgba(255,255,255,0.1)`

### 2. Navbar & Hero Section
- **Navbar**: Transparent to dark sticky, orange "Fill Now" CTA, orange active state for "Home".
- **Hero**: Two-column layout.
  - Left: Orange outlined pill, bold heading (white/orange split), benefit indicators with line icons.
  - Right: High-fidelity **Product Mockup** built with React/Tailwind (not just an image) showing the chat interface.

### 3. Product Mockup Component
- Build a realistic application interface:
  - Sidebar with "New Request" (orange active).
  - Center chat area with "Support Team" vs "You" messages.
  - Right panel with "Request Details", "Status", "Assigned To", and document list.

### 4. How It Works & Features
- **How It Works**: 5 horizontal process cards with orange arrows and line icons.
- **Features**: 6 feature cards in a 3-column grid (desktop) with orange icon containers.

### 5. Stats & CTA
- **Stats Bar**: Large horizontal dark card with orange glow.
- **Final CTA**: Large panel with orange gradient/glow, bold text, and a document/verification visual.

### 6. Footer
- Premium dark footer with 4 columns (Brand, Platform, Support, Contact).

## Technical Details
- **Architecture**: Keep the modular structure (`Navbar.tsx`, `Hero.tsx`, etc.).
- **Responsiveness**: Ensure clean stacking on mobile, reflowing the dashboard mockup for readability.
- **Interactions**: Subtle 150-300ms transitions, hover states for cards and buttons.
- **Icons**: Lucide React.
