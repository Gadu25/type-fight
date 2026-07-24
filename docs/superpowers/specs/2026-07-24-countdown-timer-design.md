# Countdown Timer Design

## Overview

Add a "3, 2, 1, Go!" countdown after clicking "Start Game". The countdown is a visual overlay with large animated numbers centered on screen. During the countdown, the typing area is visible but blurred and input-locked. The30s game timer starts only after "Go!".

## State Machine Change

```
lobby → countdown → playing → finished
```

`GameState` type becomes `'lobby' | 'countdown' | 'playing' | 'finished'`.

- **`countdown`**: Text + players are set (from `game_start` message). Game timer is NOT running. Typing area is visible but blurred. Input is locked. Countdown overlay is displayed.
- **`playing`**: Entered after countdown completes. Same as current behavior —30s timer starts, input is active.

## New Component: `Countdown.tsx`

Location: `client/src/components/Countdown.tsx`

### Props

| Prop | Type | Description |
|------|------|-------------|
| `onComplete` | `() => void` | Called when countdown finishes (after "Go!" displays) |

### Behavior

1. On mount, start a1000ms interval cycling through `3 → 2 → 1 → "Go!"`
2. Each phase displays for1000ms, except "Go!" which displays for600ms
3. After "Go!" phase completes, call `onComplete`
4. Clean up interval on unmount

### Visual Design

- **Container**: `position: fixed`, full viewport (`inset-0`), centered content (`flex items-center justify-center`), semi-transparent dark backdrop (`bg-black/60`), `z-50`
- **Number/text**: Very large font (`text-8xl md:text-9xl`), `font-black`, white (`text-white`), `select-none`
- **Animation**: CSS `countdown-pop` keyframe applied to each number, with `animation-fill-mode: both`
- **"Go!" color**: Distinct accent — `text-emerald-400` (green) to signal "go"

### Animation: `countdown-pop`

```css
@keyframes countdown-pop {
  0%   { transform: scale(0.8); opacity: 0; }
  15%  { transform: scale(1.1); opacity: 1; }
  30%  { transform: scale(1.0); }
  75%  { opacity: 1; }
  100% { opacity: 0; }
}
```

Duration: `800ms`. Each number scales up from small with a slight overshoot, holds, then fades out before the next number appears.

## Room Page Changes (`page.tsx`)

### On `game_start` message

1. Store text, players, enemy name (unchanged)
2. Set `gameState` to `'countdown'` (currently sets to `'playing'`)
3. Do NOT start game timer or position sync yet

### New handler: `handleCountdownComplete`

```ts
const handleCountdownComplete = () => {
  setGameState('playing');
  setTimeLeft(GAME_TIME_LIMIT);

  // Start game timer
  timerRef.current = setInterval(() => { ... }, 1000);

  // Start position sync
  syncIntervalRef.current = setInterval(() => { ... }, 100);
};
```

### During `'countdown'` state

- Show `EnemyPreview` (so opponent can read the text)
- Show `TypingArea` with text (so player can start reading)
- Wrap the playing area in a div with `blur-sm pointer-events-none` to visually blur and block input
- No game timer shown in header
- Show countdown overlay: `<Countdown onComplete={handleCountdownComplete} />`

### `'playing'` state rendering

- Remove blur wrapper, render `TypingArea` normally with `isActive={true}`
- Game timer appears in header (unchanged)

## Files Modified

| File | Change |
|------|--------|
| `client/src/components/Countdown.tsx` | **New file** — countdown component |
| `client/src/app/globals.css` | Add `countdown-pop` keyframe |
| `client/src/app/room/[id]/page.tsx` | Add `'countdown'` state, blur wrapper, `handleCountdownComplete` |

## Cleanup

- `Countdown` component cleans up its own interval on unmount
- Room page cleans up countdown state on `game_over` and unmount (already handles cleanup for timer/sync refs)

## Edge Cases

- **WebSocket reconnects during countdown**: If `game_start` arrives while already in countdown, ignore (already handled — `setText` etc. are idempotent)
- **Component unmounts during countdown**: `Countdown` cleans up via `useEffect` return
- **Player leaves during countdown**: `game_over` message transitions to `'finished'`, countdown unmounts naturally
