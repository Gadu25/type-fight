# Room Capacity Limit UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user feedback when a player tries to join a full room, showing toast error and room full state.

**Architecture:** Modify the room page to handle "room is full" errors from the server, display toast notification, and show a room full message in the lobby area.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS

## Global Constraints

- Use existing Tailwind CSS classes for styling
- Use existing Toast component for feedback
- No server-side changes required (error handling already exists)
- Keep user on the room page in read-only mode

---

## File Structure

### Modified Files
1. `src/app/room/[id]/page.tsx` - Add error handling and room full state

---

### Task 1: Add Room Full Error Handling

**Files:**
- Modify: `src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: Existing Toast component, existing error message from server
- Produces: `isRoomFull` state, toast notification for room full errors

- [ ] **Step 1: Add isRoomFull state variable**

In `src/app/room/[id]/page.tsx`, add after line 33:
```typescript
const [isRoomFull, setIsRoomFull] = useState(false);
```

- [ ] **Step 2: Update error handler to show toast for room full**

In `src/app/room/[id]/page.tsx`, replace lines 221-223:
```typescript
case 'error':
  console.error('Server error:', message.error?.message);
  if (message.error?.message === 'room is full') {
    setIsRoomFull(true);
    setToastMessage('This room is full. Only 2 players are allowed per match.');
  }
  break;
```

- [ ] **Step 3: Update lobby UI to show room full message**

In `src/app/room/[id]/page.tsx`, replace lines 275-290:
```typescript
{gameState === 'lobby' && (
  <div className="bg-gray-800 rounded-lg p-6 text-center">
    {isRoomFull ? (
      <>
        <p className="text-red-400 font-semibold text-lg">
          Room is Full
        </p>
        <p className="text-gray-400 mt-2">
          This match already has 2 players
        </p>
      </>
    ) : (
      <>
        <p className="text-gray-400">
          Waiting for game to start...
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Share this room code with a friend: <span className="font-mono text-white">{roomId}</span>
        </p>
        <button
          onClick={handleCopyLink}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 4: Disable Start Game button when room is full**

In `src/app/room/[id]/page.tsx`, find the PlayerList component and add the `isRoomFull` prop:
```typescript
<PlayerList
  players={players}
  hostId={hostId}
  currentPlayerId={playerId}
  gameStatus={gameState}
  onStartGame={handleStartGame}
  isRoomFull={isRoomFull}
/>
```

- [ ] **Step 5: Commit room full error handling**

```bash
git add src/app/room/[id]/page.tsx
git commit -m "feat: add room full error handling and UI feedback"
```

---

### Task 2: Update PlayerList Component

**Files:**
- Modify: `src/components/PlayerList.tsx`

**Interfaces:**
- Consumes: `isRoomFull` prop
- Produces: Disabled Start Game button when room is full

- [ ] **Step 1: Add isRoomFull prop to PlayerList**

In `src/components/PlayerList.tsx`, update the props type:
```typescript
type PlayerListProps = {
  players: Array<{ id: string; name: string }>;
  hostId: string | null;
  currentPlayerId: string | null;
  gameStatus: string;
  onStartGame: () => void;
  isRoomFull?: boolean;
};
```

- [ ] **Step 2: Disable Start Game button when room is full**

In `src/components/PlayerList.tsx`, update the button:
```typescript
<button
  onClick={onStartGame}
  disabled={currentPlayerId !== hostId || isRoomFull}
  className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
>
  Start Game
</button>
```

- [ ] **Step 3: Commit PlayerList updates**

```bash
git add src/components/PlayerList.tsx
git commit -m "feat: disable Start Game button when room is full"
```

---

### Task 3: Verify Implementation

**Files:**
- Verify: All modified files

**Interfaces:**
- None

- [ ] **Step 1: Run TypeScript compiler**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Commit final changes if needed**

```bash
git add .
git commit -m "feat: complete room capacity limit UX"
```

---

## Summary

- Task 1: Add room full error handling and UI feedback
- Task 2: Update PlayerList component to disable Start Game when room is full
- Task 3: Verify implementation
