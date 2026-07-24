# Room Features Design: Copy Button, Account System, Name Prompt

## Overview
Add three interconnected features to the Type Fight room system:
1. Copy room link button in the room lobby
2. Account system storing player data in localStorage
3. Name prompt modal for new players joining via room link

## Feature 1: Copy Room Link Button

### Description
Add a copy button in the room lobby section that allows players to copy the full room URL to their clipboard and share it with friends.

### Location
In the lobby area where it currently displays "Share this room code with a friend: {roomId}"

### Behavior
- Button displays "Copy Link" text
- On click, copies `${window.location.origin}/room/${roomId}` to clipboard
- Shows brief "Copied!" feedback (2 seconds) then reverts to "Copy Link"
- Uses the existing Toast component for feedback

### Implementation
- Add `handleCopyLink` function to `room/[id]/page.tsx`
- Update the lobby section JSX with the copy button
- State variable `copied` to track copy status

## Feature 2: Account System

### Description
Store player account data in localStorage to persist across sessions and track match history.

### Data Structure
```typescript
type PlayerAccount = {
  id: string;
  name: string;
  matchHistory: MatchRecord[];
};

type MatchRecord = {
  opponentName: string;
  winner: boolean;
  wpm: number;
  accuracy: number;
  timestamp: number;
};
```

### Storage
Single localStorage key: `typefight_account`

### Helper Functions
Create `src/lib/account.ts` with:
- `getAccount(): PlayerAccount | null` - retrieves account from localStorage
- `saveAccount(account: PlayerAccount): void` - saves account to localStorage
- `updateMatchHistory(match: MatchRecord): void` - adds match to history and saves
- `createAccount(name: string): PlayerAccount` - creates new account with UUID

### Integration Points
1. Home page: Use `getAccount()` to check for existing account, pre-fill name if exists
2. Room page: Check for account on mount, show modal if missing
3. Game results: Save match data via `updateMatchHistory()`

## Feature 3: Name Prompt Modal

### Description
When a user enters a room via link without an account, display a modal overlay requiring them to enter their name before proceeding.

### Modal Behavior
- Modal blocks interaction with room content until name is submitted
- Contains text input for player name
- "Join Room" button (disabled until name entered)
- On submit: create account, save to localStorage, proceed to room

### Modal Content
- Title: "Welcome to Type Fight!"
- Subtitle: "Enter your name to join the room"
- Input field with placeholder "Your name"
- Button: "Join Room"

### Implementation
- Create new component `src/components/NamePromptModal.tsx`
- Import and use in `room/[id]/page.tsx`
- State: `showNameModal` (boolean), `pendingName` (string)
- On modal submit: create account, hide modal, proceed with WebSocket connection

## File Changes

### New Files
1. `src/lib/account.ts` - Account helper functions
2. `src/components/NamePromptModal.tsx` - Name prompt modal component

### Modified Files
1. `src/app/room/[id]/page.tsx` - Add copy button, account check, modal integration
2. `src/app/page.tsx` - Use account system for name persistence

## Dependencies
- Uses existing Toast component for copy feedback
- Uses existing WebSocket setup (no changes to `src/lib/ws.ts`)

## Future Considerations
- Match history page (not in scope for this implementation)
- Account settings/profile page (not in scope)
- Server-side account sync (not in scope)
