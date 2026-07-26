# Profile Side Panel Design

## Overview

Add a toggleable right-side panel that displays user profile stats on both the home page and room lobby. The panel slides in from the right as an overlay, triggered by a profile icon in the header bar.

## Motivation

The `PlayerAccount` in localStorage stores match history data (wins, losses, WPM, accuracy) that is never displayed to the user. This feature surfaces that data to give players feedback on their performance over time.

## User Flow

1. User sees a small profile icon in the top-right corner of the header on any page
2. Clicking the icon slides in the profile panel from the right
3. Panel displays: name, winrate, avg WPM, total games, and scrollable match history
4. Clicking the icon again or clicking outside the panel closes it

## Components

### `ProfileToggle`

A small icon button that triggers the panel.

- **Props**: `onClick: () => void`
- **Render**: User icon (from a simple SVG or icon library if available, otherwise a styled button with text)
- **Placement**: Top-right of the header bar on both pages

### `ProfilePanel`

The sliding side panel displaying user stats.

- **Props**: `isOpen: boolean`, `onClose: () => void`
- **Behavior**:
  - Slides in from the right when `isOpen` is true
  - Fixed position, full height, ~320px width
  - Semi-transparent backdrop when open (click to close)
  - Reads account data from `getAccount()` in `client/src/lib/account.ts`
- **Content** (top to bottom):
  - Player name (large, bold)
  - Stats row: Winrate | Avg WPM | Total Games
  - Divider
  - Match history list (scrollable, most recent first):
    - Each entry: opponent name, W/L indicator, WPM, accuracy, timestamp (relative)

### `Header`

Minimal header bar added to both pages.

- **Home page**: New header with just the `ProfileToggle` icon (and optionally the logo)
- **Room page**: `ProfileToggle` icon added to the existing header bar (right side, before the timer/room ID)

## Layout Changes

### Home Page (`client/src/app/page.tsx`)

- Add a minimal header bar at the top with the `ProfileToggle` icon
- Main content (centered card) remains unchanged below the header
- `ProfilePanel` rendered at the page level, toggled by the header icon

### Room Page (`client/src/app/room/[id]/page.tsx`)

- Add `ProfileToggle` icon to the existing header bar (right side)
- `ProfilePanel` rendered at the page level, toggled by the header icon
- Panel overlays the game content when open (no layout shift)

## Styling

- Panel background: `bg-gray-800` (matches existing dark theme)
- Panel border-left: subtle border or shadow for depth
- Slide animation: CSS transition on `transform` (translateX)
- Backdrop: semi-transparent black overlay (`bg-black/50`)
- Stats: clean layout with labels and values
- Match history entries: alternating subtle background for readability
- W/L indicator: green dot for win, red dot for loss

## Data

Reads from localStorage via existing helpers in `client/src/lib/account.ts`:

```typescript
const account = getAccount();
// account.name
// account.matchHistory[]
```

Computed stats (no new storage needed):
- **Winrate**: `matchHistory.filter(m => m.winner).length / matchHistory.length`
- **Avg WPM**: `matchHistory.reduce((sum, m) => sum + m.wpm, 0) / matchHistory.length`
- **Total games**: `matchHistory.length`

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `client/src/components/ProfilePanel.tsx` | Create | The sliding side panel component |
| `client/src/components/ProfileToggle.tsx` | Create | The icon button trigger |
| `client/src/app/page.tsx` | Modify | Add header with toggle + render panel |
| `client/src/app/room/[id]/page.tsx` | Modify | Add toggle to header + render panel |

## Edge Cases

- **No account yet**: Panel shows a message like "Play a game to see your stats" or is hidden entirely
- **Empty match history**: Stats show 0/0 for winrate, 0 for avg WPM, "No games yet" for history
- **Many matches**: History list scrolls, only renders visible entries (simple overflow-y-auto is sufficient)
