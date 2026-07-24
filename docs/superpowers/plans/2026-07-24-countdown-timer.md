# Countdown Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "3, 2, 1, Go!" countdown overlay after clicking "Start Game" with large animated numbers centered on screen, blurring the typing area during countdown, and starting the30s game timer only after "Go!".

**Architecture:** New `Countdown.tsx` component renders a fixed-position overlay with animated numbers. Room page gains a `'countdown'` game state between `'lobby'` and `'playing'`. During countdown, the playing area is blurred via a wrapper div. Game timer starts in `handleCountdownComplete`.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS v4, TypeScript 5

## Global Constraints

- All styling via Tailwind CSS utility classes (no CSS modules)
- TypeScript strict mode
- Existing component patterns: `'use client'` directive, functional components, props interfaces
- File paths use `@/*` alias mapping to `./src/*`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `client/src/components/Countdown.tsx` | Create | Countdown overlay component |
| `client/src/app/globals.css` | Modify | Add `countdown-pop` keyframe |
| `client/src/app/room/[id]/page.tsx` | Modify | Add `'countdown'` state, blur wrapper, `handleCountdownComplete` |

---

### Task 1: Create Countdown Component

**Files:**
- Create: `client/src/components/Countdown.tsx`

**Interfaces:**
- Consumes: none (standalone component)
- Produces: `<Countdown onComplete={() => void} />` — renders overlay, calls `onComplete` after countdown finishes

- [ ] **Step 1: Create the Countdown component**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  onComplete: () => void;
}

type CountdownPhase = '3' | '2' | '1' | 'Go!';

const PHASES: CountdownPhase[] = ['3', '2', '1', 'Go!'];
const PHASE_DURATION = 1000;
const GO_DISPLAY_DURATION = 600;

export default function Countdown({ onComplete }: CountdownProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const phase = PHASES[phaseIndex];
    const duration = phase === 'Go!' ? GO_DISPLAY_DURATION : PHASE_DURATION;

    const timer = setTimeout(() => {
      if (phaseIndex < PHASES.length - 1) {
        setPhaseIndex(phaseIndex + 1);
      } else {
        onComplete();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [phaseIndex, onComplete]);

  const isGo = PHASES[phaseIndex] === 'Go!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        key={phaseIndex}
        className={`text-8xl md:text-9xl font-black select-none countdown-pop ${
          isGo ? 'text-emerald-400' : 'text-white'
        }`}
      >
        {PHASES[phaseIndex]}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd client && npx tsc --noEmit --pretty`
Expected: No errors (countdown-pop class not yet defined in CSS, but TypeScript won't flag unknown Tailwind classes)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Countdown.tsx
git commit -m "feat: add Countdown component with 3-2-1-Go animation"
```

---

### Task 2: Add CSS Keyframe

**Files:**
- Modify: `client/src/app/globals.css`

**Interfaces:**
- Consumes: none
- Produces: `.countdown-pop` CSS class available to Tailwind

- [ ] **Step 1: Add keyframe to globals.css**

Append the following after the existing `@keyframes fade-in` block (after line 17):

```css
@keyframes countdown-pop {
  0%   { transform: scale(0.8); opacity: 0; }
  15%  { transform: scale(1.1); opacity: 1; }
  30%  { transform: scale(1.0); }
  75%  { opacity: 1; }
  100% { opacity: 0; }
}

.countdown-pop {
  animation: countdown-pop 800ms ease-out both;
}
```

- [ ] **Step 2: Verify no build errors**

Run: `cd client && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds (or only unrelated warnings)

- [ ] **Step 3: Commit**

```bash
git add client/src/app/globals.css
git commit -m "feat: add countdown-pop keyframe animation"
```

---

### Task 3: Integrate Countdown into Room Page

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: `<Countdown onComplete={handleCountdownComplete} />` from Task 1
- Produces: Full countdown flow — `'lobby'` → `'countdown'` → `'playing'`

- [ ] **Step 1: Update GameState type (line 12)**

Change:
```ts
type GameState = 'lobby' | 'playing' | 'finished';
```
To:
```ts
type GameState = 'lobby' | 'countdown' | 'playing' | 'finished';
```

- [ ] **Step 2: Add Countdown import (after line 10)**

Add:
```ts
import Countdown from '@/components/Countdown';
```

- [ ] **Step 3: Update `game_start` handler (lines 100-138)**

Replace the `case 'game_start':` block with:

```ts
      case 'game_start':
        if (message.text && message.players) {
          setText(message.text);
          setPlayers(message.players);
          setGameState('countdown');
          setCurrentPosition(0);
          setTimeLeft(GAME_TIME_LIMIT);
          setEnemyPosition(0);
          setToastMessage(null);

          const enemy = message.players.find(p => p.id !== playerId);
          if (enemy) setEnemyName(enemy.name);
        }
        break;
```

Key changes: `setGameState('countdown')` instead of `'playing'`, removed timer/sync start (those move to `handleCountdownComplete`).

- [ ] **Step 4: Add `handleCountdownComplete` callback (after `handleStartGame`, around line 189)**

```ts
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pendingPositionRef.current = 0;
    lastSentPositionRef.current = 0;
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    syncIntervalRef.current = setInterval(() => {
      if (ws && pendingPositionRef.current !== lastSentPositionRef.current) {
        sendMessage(ws, {
          type: 'keystroke',
          char: '',
          position: pendingPositionRef.current,
        });
        lastSentPositionRef.current = pendingPositionRef.current;
      }
    }, 100);
  }, [ws]);
```

- [ ] **Step 5: Add blur wrapper and countdown overlay to JSX**

Replace the `gameState === 'playing'` block (lines 233-249) with:

```tsx
            {(gameState === 'countdown' || gameState === 'playing') && (
              <div className={gameState === 'countdown' ? 'blur-sm pointer-events-none' : ''}>
                <div className="space-y-4">
                  {enemyName && (
                    <EnemyPreview
                      text={text}
                      enemyPosition={enemyPosition}
                      enemyName={enemyName}
                    />
                  )}
                  <TypingArea
                    text={text}
                    onKeystroke={handleKeystroke}
                    isActive={gameState === 'playing'}
                    currentPosition={currentPosition}
                  />
                </div>
              </div>
            )}

            {gameState === 'countdown' && (
              <Countdown onComplete={handleCountdownComplete} />
            )}
```

- [ ] **Step 6: Update timer display to only show during playing (lines 199-203)**

The existing timer display already checks `gameState === 'playing'` so it will not show during countdown. No change needed here.

- [ ] **Step 7: Verify build compiles**

Run: `cd client && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add client/src/app/room/\[id\]/page.tsx
git commit -m "feat: integrate countdown into game flow"
```

---

### Task 4: End-to-End Verification

- [ ] **Step 1: Run existing tests**

Run: `cd client && npx vitest run`
Expected: All tests pass (no existing tests should be affected)

- [ ] **Step 2: Manual verification**

Run: `cd client && npm run dev`

1. Open two browser tabs to `http://localhost:3000`
2. Create a room in tab 1, join in tab 2
3. Host clicks "Start Game"
4. Verify: typing area is visible but blurred, "3" appears centered with animation
5. Verify: "3" → "2" → "1" → "Go!" cycle takes ~4s total
6. Verify: after "Go!", blur is removed, typing is enabled,30s timer appears in header
7. Verify: typing works correctly after countdown

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "fix: address review feedback for countdown feature"
```
