# Room Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add copy room link button, account system with localStorage, and name prompt modal for new players.

**Architecture:** Create account helper library, name prompt modal component, modify room page to integrate these features, and update home page to use account system.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS

## Global Constraints

- Use existing Tailwind CSS classes for styling
- Use existing Toast component for feedback
- localStorage key: `typefight_account`
- No server-side changes required

---

## File Structure

### New Files
1. `src/lib/account.ts` - Account helper functions (get, save, create, update history)
2. `src/components/NamePromptModal.tsx` - Modal component for name entry

### Modified Files
1. `src/app/room/[id]/page.tsx` - Add copy button, account check, modal integration
2. `src/app/page.tsx` - Use account system for name persistence

---

### Task 1: Create Account Helper Library

**Files:**
- Create: `src/lib/account.ts`

**Interfaces:**
- Produces: `getAccount()`, `saveAccount()`, `createAccount()`, `updateMatchHistory()`

- [ ] **Step 1: Create account.ts with types and helper functions**

```typescript
export type MatchRecord = {
  opponentName: string;
  winner: boolean;
  wpm: number;
  accuracy: number;
  timestamp: number;
};

export type PlayerAccount = {
  id: string;
  name: string;
  matchHistory: MatchRecord[];
};

const STORAGE_KEY = 'typefight_account';

export function getAccount(): PlayerAccount | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as PlayerAccount;
  } catch {
    return null;
  }
}

export function saveAccount(account: PlayerAccount): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}

export function createAccount(name: string): PlayerAccount {
  const account: PlayerAccount = {
    id: crypto.randomUUID(),
    name,
    matchHistory: [],
  };
  saveAccount(account);
  return account;
}

export function updateMatchHistory(match: MatchRecord): void {
  const account = getAccount();
  if (account) {
    account.matchHistory.push(match);
    saveAccount(account);
  }
}
```

- [ ] **Step 2: Commit account helper library**

```bash
git add src/lib/account.ts
git commit -m "feat: add account helper library with localStorage persistence"
```

---

### Task 2: Create NamePromptModal Component

**Files:**
- Create: `src/components/NamePromptModal.tsx`

**Interfaces:**
- Consumes: `createAccount()` from `src/lib/account.ts`
- Produces: `NamePromptModal` component

- [ ] **Step 1: Create NamePromptModal component**

```tsx
'use client';

import { useState } from 'react';

type NamePromptModalProps = {
  onNameSubmitted: (name: string) => void;
};

export default function NamePromptModal({ onNameSubmitted }: NamePromptModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onNameSubmitted(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-2 text-center">Welcome to Type Fight!</h2>
        <p className="text-gray-400 mb-6 text-center">Enter your name to join the room</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit NamePromptModal component**

```bash
git add src/components/NamePromptModal.tsx
git commit -m "feat: add NamePromptModal component for new players"
```

---

### Task 3: Add Copy Button to Room Page

**Files:**
- Modify: `src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: None (standalone feature)
- Produces: Copy button in lobby section

- [ ] **Step 1: Add state variable for copied status**

In `src/app/room/[id]/page.tsx`, add after line 33:
```typescript
const [copied, setCopied] = useState(false);
```

- [ ] **Step 2: Add handleCopyLink function**

In `src/app/room/[id]/page.tsx`, add after the state variables:
```typescript
const handleCopyLink = async () => {
  const url = `${window.location.origin}/room/${roomId}`;
  await navigator.clipboard.writeText(url);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

- [ ] **Step 3: Update lobby section with copy button**

Replace lines 222-230 in `src/app/room/[id]/page.tsx`:
```typescript
{gameState === 'lobby' && (
  <div className="bg-gray-800 rounded-lg p-6 text-center">
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
  </div>
)}
```

- [ ] **Step 4: Commit copy button feature**

```bash
git add src/app/room/[id]/page.tsx
git commit -m "feat: add copy room link button in lobby"
```

---

### Task 4: Integrate Account System and Name Modal in Room Page

**Files:**
- Modify: `src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: `getAccount()`, `createAccount()` from `src/lib/account.ts`, `NamePromptModal` component
- Produces: Account check on mount, modal for new players

- [ ] **Step 1: Import account functions and NamePromptModal**

At top of `src/app/room/[id]/page.tsx`, add imports:
```typescript
import { getAccount, createAccount } from '@/lib/account';
import NamePromptModal from '@/components/NamePromptModal';
```

- [ ] **Step 2: Add state variable for name modal**

In `src/app/room/[id]/page.tsx`, add after line 33:
```typescript
const [showNameModal, setShowNameModal] = useState(false);
```

- [ ] **Step 3: Modify useEffect to check for account**

Replace the useEffect in `src/app/room/[id]/page.tsx` (lines 41-73) with:
```typescript
useEffect(() => {
  const account = getAccount();
  
  if (!account) {
    setShowNameModal(true);
    return;
  }

  setPlayerId(account.id);
  wsOpenedRef.current = false;

  const websocket = createWebSocket(
    roomId,
    (msg) => handleMessageRef.current(msg),
    () => {
      wsOpenedRef.current = true;
      sendMessage(websocket, {
        type: 'join',
        player_name: account.name,
      });
    }
  );
  setWs(websocket);

  return () => {
    if (wsOpenedRef.current) {
      websocket.close();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
  };
}, [roomId]);
```

- [ ] **Step 4: Add handleNameSubmitted function**

In `src/app/room/[id]/page.tsx`, add after handleCopyLink:
```typescript
const handleNameSubmitted = (name: string) => {
  const account = createAccount(name);
  setPlayerId(account.id);
  setShowNameModal(false);
  
  wsOpenedRef.current = false;
  const websocket = createWebSocket(
    roomId,
    (msg) => handleMessageRef.current(msg),
    () => {
      wsOpenedRef.current = true;
      sendMessage(websocket, {
        type: 'join',
        player_name: account.name,
      });
    }
  );
  setWs(websocket);
};
```

- [ ] **Step 5: Add NamePromptModal to JSX**

Before the closing `</main>` tag, add:
```typescript
{showNameModal && (
  <NamePromptModal onNameSubmitted={handleNameSubmitted} />
)}
```

- [ ] **Step 6: Update handleMessage to use account ID**

In the `player_list` case (lines 77-88), update to use account:
```typescript
case 'player_list':
  if (message.players) {
    setPlayers(message.players);
    if (message.players.length > 0 && !hostId) {
      setHostId(message.players[0].id);
    }
  }
  if (message.your_player_id) {
    const account = getAccount();
    if (account && account.id !== message.your_player_id) {
      account.id = message.your_player_id;
      saveAccount(account);
    }
    setPlayerId(message.your_player_id);
  }
  break;
```

- [ ] **Step 7: Commit account integration**

```bash
git add src/app/room/[id]/page.tsx
git commit -m "feat: integrate account system and name modal in room page"
```

---

### Task 5: Save Match History on Game Completion

**Files:**
- Modify: `src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateMatchHistory()` from `src/lib/account.ts`
- Produces: Match history saved to account

- [ ] **Step 1: Import updateMatchHistory**

At top of `src/app/room/[id]/page.tsx`, add to imports:
```typescript
import { getAccount, createAccount, updateMatchHistory } from '@/lib/account';
```

- [ ] **Step 2: Save match history in game_over handler**

In the `game_over` case (lines 157-166), add match history saving:
```typescript
case 'game_over':
  if (message.results && message.winner !== undefined) {
    if (timerRef.current) clearInterval(timerRef.current);
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    setResults(message.results);
    setWinner(message.winner);
    setGameState('finished');
    setToastMessage(null);
    
    // Save match history
    const account = getAccount();
    if (account) {
      const opponent = message.results.find(r => r.player_id !== playerId);
      if (opponent) {
        updateMatchHistory({
          opponentName: opponent.name,
          winner: message.winner === playerId,
          wpm: opponent.wpm,
          accuracy: opponent.accuracy,
          timestamp: Date.now(),
        });
      }
    }
  }
  break;
```

- [ ] **Step 3: Commit match history saving**

```bash
git add src/app/room/[id]/page.tsx
git commit -m "feat: save match history to account on game completion"
```

---

### Task 6: Update Home Page to Use Account System

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getAccount()`, `createAccount()` from `src/lib/account.ts`
- Produces: Name persistence on home page

- [ ] **Step 1: Import account functions**

At top of `src/app/page.tsx`, add:
```typescript
import { getAccount, createAccount } from '@/lib/account';
```

- [ ] **Step 2: Add useEffect to load existing account**

After the useState declarations, add:
```typescript
const [existingAccount, setExistingAccount] = useState<ReturnType<typeof getAccount>>(null);

useEffect(() => {
  const account = getAccount();
  if (account) {
    setExistingAccount(account);
    setPlayerName(account.name);
  }
}, []);
```

- [ ] **Step 3: Update handleCreateRoom to use account**

Replace handleCreateRoom (lines 11-23):
```typescript
const handleCreateRoom = async () => {
  if (!playerName.trim()) return;
  
  let account = getAccount();
  if (!account) {
    account = createAccount(playerName);
  } else {
    account.name = playerName;
    localStorage.setItem('typefight_account', JSON.stringify(account));
  }
  
  const response = await fetch('/api/rooms', {
    method: 'POST',
  });
  
  const data = await response.json();
  localStorage.setItem('playerId', data.player_id);
  
  router.push(`/room/${data.room_id}`);
};
```

- [ ] **Step 4: Update handleJoinRoom to use account**

Replace handleJoinRoom (lines 25-30):
```typescript
const handleJoinRoom = () => {
  if (!playerName.trim() || !joinRoomId.trim()) return;
  
  let account = getAccount();
  if (!account) {
    account = createAccount(playerName);
  } else {
    account.name = playerName;
    localStorage.setItem('typefight_account', JSON.stringify(account));
  }
  
  router.push(`/room/${joinRoomId}`);
};
```

- [ ] **Step 5: Commit home page updates**

```bash
git add src/app/page.tsx
git commit -m "feat: update home page to use account system"
```

---

### Task 7: Run Tests and Verify

**Files:**
- Verify: All modified files

**Interfaces:**
- None

- [ ] **Step 1: Run any existing tests**

```bash
npm test
```

- [ ] **Step 2: Start development server and test manually**

```bash
npm run dev
```

Test the following:
1. Create a room as a new user - should work without issues
2. Copy room link button - should copy URL and show "Copied!"
3. Join room via link as new user - should show name modal
4. Submit name in modal - should create account and join room
5. Play a game - should save match history to account
6. Refresh page - should remember user name

- [ ] **Step 3: Final commit if needed**

```bash
git add .
git commit -m "feat: complete room features implementation"
```

---

## Summary

- Task 1: Create account helper library
- Task 2: Create NamePromptModal component
- Task 3: Add copy button to room page
- Task 4: Integrate account system and name modal in room page
- Task 5: Save match history on game completion
- Task 6: Update home page to use account system
- Task 7: Run tests and verify
