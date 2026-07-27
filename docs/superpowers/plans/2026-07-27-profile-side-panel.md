# Profile Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable right-side panel that displays user profile stats (name, winrate, avg WPM, match history) on both the home page and room lobby.

**Architecture:** Two new components (`ProfileToggle` and `ProfilePanel`) integrated into existing pages. The toggle button lives in the header bar; the panel slides in from the right as an overlay. Both components read from the existing `getAccount()` helper in `client/src/lib/account.ts`.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS v4

## Global Constraints

- All styling uses Tailwind utility classes (no CSS modules, no styled-components)
- Dark theme: `bg-gray-800`, `bg-gray-700`, `bg-gray-900`, white text
- Components use `'use client'` directive
- No new dependencies or icon libraries — use inline SVG for the profile icon
- Follow existing component patterns (see `PlayerList.tsx`, `Results.tsx`)

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/components/ProfileToggle.tsx` | Create | Icon button that triggers the panel |
| `client/src/components/ProfilePanel.tsx` | Create | Sliding side panel with stats and match history |
| `client/src/app/page.tsx` | Modify | Add minimal header with toggle + render panel |
| `client/src/app/room/[id]/page.tsx` | Modify | Add toggle to existing header + render panel |

---

### Task 1: Create ProfileToggle Component

**Files:**
- Create: `client/src/components/ProfileToggle.tsx`

**Interfaces:**
- Consumes: none
- Produces: `<ProfileToggle onClick={() => void} />` — exported default component

- [ ] **Step 1: Create the ProfileToggle component**

```tsx
'use client';

interface ProfileToggleProps {
  onClick: () => void;
}

export default function ProfileToggle({ onClick }: ProfileToggleProps) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-md hover:bg-gray-700 transition-colors"
      aria-label="Open profile"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit --project client/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ProfileToggle.tsx
git commit -m "feat: add ProfileToggle component"
```

---

### Task 2: Create ProfilePanel Component

**Files:**
- Create: `client/src/components/ProfilePanel.tsx`

**Interfaces:**
- Consumes: `getAccount()` from `@/lib/account` (already exists)
- Produces: `<ProfilePanel isOpen={boolean} onClose={() => void} />` — exported default component

- [ ] **Step 1: Create the ProfilePanel component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getAccount, PlayerAccount, MatchRecord } from '@/lib/account';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function computeStats(account: PlayerAccount) {
  const total = account.matchHistory.length;
  if (total === 0) {
    return { winrate: 0, avgWpm: 0, totalGames: 0 };
  }
  const wins = account.matchHistory.filter((m) => m.winner).length;
  const avgWpm =
    account.matchHistory.reduce((sum, m) => sum + m.wpm, 0) / total;
  return {
    winrate: (wins / total) * 100,
    avgWpm,
    totalGames: total,
  };
}

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const [account, setAccount] = useState<PlayerAccount | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccount(getAccount());
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-gray-800 border-l border-gray-700 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold">Profile</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-700 transition-colors"
              aria-label="Close profile"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {!account ? (
              <p className="text-gray-400 text-center mt-8">
                Play a game to see your stats.
              </p>
            ) : (
              <>
                {/* Name */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold">{account.name}</h3>
                </div>

                {/* Stats */}
                {account.matchHistory.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <span className="text-xs text-gray-400 block">Winrate</span>
                      <span className="text-xl font-bold">
                        {computeStats(account).winrate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-400 block">Avg WPM</span>
                      <span className="text-xl font-bold">
                        {computeStats(account).avgWpm.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-400 block">Games</span>
                      <span className="text-xl font-bold">
                        {computeStats(account).totalGames}
                      </span>
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-700 mb-4" />

                {/* Match History */}
                <h4 className="text-sm font-semibold text-gray-400 mb-3">
                  Match History
                </h4>
                {account.matchHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No games yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...account.matchHistory]
                      .reverse()
                      .map((match: MatchRecord, i: number) => (
                        <div
                          key={i}
                          className="p-3 bg-gray-700 rounded-md"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">
                              vs {match.opponentName}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                match.winner ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>{match.wpm.toFixed(1)} WPM</span>
                            <span>{match.accuracy.toFixed(1)}%</span>
                            <span>{formatDate(match.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit --project client/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ProfilePanel.tsx
git commit -m "feat: add ProfilePanel component"
```

---

### Task 3: Integrate Profile Panel into Home Page

**Files:**
- Modify: `client/src/app/page.tsx`

**Interfaces:**
- Consumes: `<ProfileToggle />` and `<ProfilePanel />` from Task 1 and Task 2
- Produces: Home page with header containing profile toggle and sliding panel

- [ ] **Step 1: Add imports and state to home page**

At the top of `client/src/app/page.tsx`, add imports:

```tsx
import ProfileToggle from '@/components/ProfileToggle';
import ProfilePanel from '@/components/ProfilePanel';
```

Inside the `Home` component, add state:

```tsx
const [showProfile, setShowProfile] = useState(false);
```

- [ ] **Step 2: Add header and panel to the JSX**

Replace the existing return statement's `<main>` tag content. The current structure is:

```tsx
return (
  <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
      ...existing card content...
    </div>
  </main>
);
```

Change it to:

```tsx
return (
  <main className="min-h-screen bg-gray-900 text-white">
    {/* Header */}
    <header className="flex justify-end items-center p-4">
      <ProfileToggle onClick={() => setShowProfile(true)} />
    </header>

    {/* Centered card */}
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        ...existing card content (unchanged)...
      </div>
    </div>

    {/* Profile Panel */}
    <ProfilePanel isOpen={showProfile} onClose={() => setShowProfile(false)} />
  </main>
);
```

- [ ] **Step 3: Verify the page compiles**

Run: `npx tsc --noEmit --project client/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/app/page.tsx
git commit -m "feat: add profile panel to home page"
```

---

### Task 4: Integrate Profile Panel into Room Page

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: `<ProfileToggle />` and `<ProfilePanel />` from Task 1 and Task 2
- Produces: Room page with profile toggle in header and sliding panel

- [ ] **Step 1: Add imports to room page**

At the top of `client/src/app/room/[id]/page.tsx`, add:

```tsx
import ProfileToggle from '@/components/ProfileToggle';
import ProfilePanel from '@/components/ProfilePanel';
```

- [ ] **Step 2: Add state for profile panel**

Inside the `RoomPage` component, add alongside the other state declarations (near line 39):

```tsx
const [showProfile, setShowProfile] = useState(false);
```

- [ ] **Step 3: Add toggle button to the existing header**

In the header section (around lines 271-280), the current right-side content is:

```tsx
<div className="flex items-center gap-4">
  {gameState === 'playing' && (
    <div className={`text-2xl font-mono font-bold ${timerColor}`}>
      {timeLeft}s
    </div>
  )}
  <div className="text-sm text-gray-400">
    Room: {roomId}
  </div>
</div>
```

Add the `ProfileToggle` before the existing items:

```tsx
<div className="flex items-center gap-4">
  <ProfileToggle onClick={() => setShowProfile(true)} />
  {gameState === 'playing' && (
    <div className={`text-2xl font-mono font-bold ${timerColor}`}>
      {timeLeft}s
    </div>
  )}
  <div className="text-sm text-gray-400">
    Room: {roomId}
  </div>
</div>
```

- [ ] **Step 4: Add ProfilePanel to the JSX**

At the end of the return statement, just before the closing `</main>` tag (after the `NamePromptModal`), add:

```tsx
<ProfilePanel isOpen={showProfile} onClose={() => setShowProfile(false)} />
```

- [ ] **Step 5: Verify the page compiles**

Run: `npx tsc --noEmit --project client/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add client/src/app/room/[id]/page.tsx
git commit -m "feat: add profile panel to room page"
```

---

### Task 5: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit --project client/tsconfig.json`
Expected: No errors

- [ ] **Step 2: Run linter if configured**

Check if eslint is configured, then run it:
Run: `cd client && npm run lint` (if script exists)
Expected: No errors

- [ ] **Step 3: Run existing tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 4: Manual verification checklist**

- [ ] Home page shows profile icon in top-right
- [ ] Clicking icon opens panel from right side
- [ ] Panel shows "Play a game to see your stats" when no account
- [ ] Panel closes when clicking backdrop or X button
- [ ] Room page shows profile icon in header
- [ ] Panel works the same way in room page
- [ ] Stats update after completing a match
- [ ] Match history shows in reverse chronological order
