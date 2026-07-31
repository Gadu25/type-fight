# Character Sprite Animations & Battle HUD Redesign

## Overview

Replace the static single-frame SVG sprites on the battlefield with frame-by-frame animations driven by per-character sprite sheets. Each of the 7 tiers gets 5 sprite sheets (idle, attack1, attack2, hurt, dead), all single-row strips of square 128×128 frames. A new `SpriteAnimator` component auto-detects frame count from the sheet's width, and `BattleStage` drives each fighter through a team-level state machine (attack / hurt / dead). The center-screen attack selector is removed and replaced by a compact, clickable hotkey legend pinned to the bottom-right showing only hotkey + character name.

## Sprite Sheet Format & Asset Structure

- All sheets are PNGs, **128px tall**, single row of **square 128×128 frames**. Frame count is auto-detected: `frameCount = naturalWidth / 128`.
- Folder structure (Approach A — per-character folder):

```
client/public/sprites/
├── grunt/
│   ├── idle.png
│   ├── attack1.png
│   ├── attack2.png
│   ├── hurt.png
│   └── dead.png
├── archer/   (same 5 files)
├── paladin/  (same 5 files)
├── wizard/   (same 5 files)
├── cleric/   (same 5 files)
├── priest/   (same 5 files)
└── saint/    (same 5 files)
```

- The existing flat SVGs in `client/public/sprites/` (e.g. `grunt_idle.svg`) are retired; `tiers.ts` no longer generates sprite paths for the battlefield.

## Manifest: `client/src/lib/characterSprites.ts`

New module mapping each tier to its 5 sheets + per-state total duration:

```ts
interface CharacterAnimation {
  idle:   { src: string; duration: number }
  attack1: { src: string; duration: number }
  attack2: { src: string; duration: number }
  hurt:   { src: string; duration: number }
  dead:   { src: string; duration: number }
}
export const CHARACTER_ANIMATIONS: Record<Tier, CharacterAnimation>
export function getRandomAttackAnim(tier: Tier): { src: string; duration: number }
```

- Paths follow `/sprites/<tier>/<state>.png`.
- Durations are **total ms for one full pass** (the animator divides evenly by frame count). Suggested defaults (tunable per character later): idle ~2000ms, attack1/attack2 ~700ms, hurt ~400ms, dead ~900ms.
- `getRandomAttackAnim` returns attack1 or attack2 with 50/50 probability.

## `SpriteAnimator` Component (`client/src/components/battle/SpriteAnimator.tsx`)

Replaces the static `FighterSprite`. Props:

```ts
interface SpriteAnimatorProps {
  src: string
  height?: number        // display height; frame width = height (square frames). default 128
  duration: number       // total ms for one full pass
  mode: 'loop' | 'once' | 'hold'
  onComplete?: () => void
}
```

Behavior:

- **Auto-detect frames:** on image `load`, read `naturalWidth`, compute `frameCount = naturalWidth / 128`. Guard: if `naturalWidth < 128`, render nothing.
- **Rendering:** fixed-size container (`width: height`, `height`) with `overflow: hidden`; inner `<img>` width `frameCount × height`, translated horizontally (`translateX(-frameIndex × height)`) to reveal one frame at a time. `image-rendering: pixelated` for crisp pixel art.
- **Timing:** JS-driven frame index via `requestAnimationFrame` + `performance.now()`. Per-frame time = `duration / frameCount`.
- **Modes:**
  - `loop` — wrap frame index forever (idle).
  - `once` — play through, then fire `onComplete` once (attack/hurt; caller returns the fighter to idle).
  - `hold` — play through once, pause on the final frame, no `onComplete` (dead).
- Restarting: when `src` changes (or a new animation is requested), reset frame index to 0.
- No code comments (project convention).

## Fighter State Machine (`BattleStage.tsx`)

Team-level, derived inside `BattleStage` from props. New props:

```ts
interface BattleStageProps {
  battleground: Battleground
  playerTeam: Team
  opponentTeam: Team
  activePlayerTier: Tier | null
  activeOpponentTier: Tier | null
  cameraMode: CameraMode
  playerHP: number      // NEW
  opponentHP: number    // NEW
}
```

Per-side logic (both sides symmetric):

- **Dead:** `useEffect` — when side HP reaches 0, flip that side's `dead = true` (terminal). All 4 fighters on the side render with `mode="hold"` dead sheet, with the active-tier fighter's attack/hurt overridden.
- **Hurt:** `useEffect` tracking previous HP — a decrease (`prevHP > hp`) increments a `hurtKey` for that side. While hurt is active, ALL 4 fighters on the side play the hurt sheet once (`mode="once"`, `onComplete` → back to idle). A new hit increments `hurtKey`, which is used as the React `key` on each fighter's `SpriteAnimator` so the hurt animation remounts and restarts from frame 0. Heal/HP increases do not trigger hurt.
- **Attack:** the fighter whose tier === `activePlayerTier` (or `activeOpponentTier`) plays a random attack once (`mode="once"`, `onComplete` → idle). Only one fighter per side attacks at a time. Hurt/dead on that fighter take precedence over attack.
- **Priority:** `dead > hurt > attack > idle` per fighter.
- Fighters with a tier not present in the team render nothing (unchanged from today).
- Opponent team mirroring (`scaleX(-1)`) unchanged.
- When side HP is already 0 at mount (e.g. game_start after knockout), the side mounts directly in dead.

`FighterSprite.tsx` is removed; `BattleStage` renders `SpriteAnimator` directly. The CSS `fighter-bob` idle bounce on `FighterSprite` is dropped (replaced by the idle loop sheet).

## HUD / Attack-Selector Redesign

- Delete the center `AttackSelector` usage from the battle screen (the big sprite-button panel). The component itself is removed.
- New component `client/src/components/battle/AttackHotkeys.tsx`: compact panel pinned **bottom-right** of the screen, showing ONLY the player's team — one clickable row per member: `[1] Grunt`, `[2] Archer`, ... — hotkey number + character name, **no sprites/visuals**.
  - Clicking a row calls `onSelect(tier)` (same handler as today).
  - Keyboard shortcuts 1–7 still trigger `select_attack` (keydown logic moves from AttackSelector into this component).
  - Highlights the row of the currently-active `currentAttack` tier.
  - Only tiers in the player's team render (4 rows max).
- Center HUD (health bars, battle timer, typing area, floating damage numbers, attack banner) stays as-is. Only the attack selector moves bottom-right and shrinks.
- `page.tsx`: replace `<AttackSelector …/>` block with `<AttackHotkeys …/>`; pass `playerHP`/`opponentHP` to `BattleStage`. All other page logic unchanged.

## Data Flow

```
page.tsx
  ├─ playerHP / opponentHP ──────► BattleStage (derives hurt/dead per side)
  ├─ activePlayerTier ───────────► BattleStage (attack on that fighter)
  ├─ activeOpponentTier ─────────► BattleStage (attack on that fighter)
  ├─ onSelect(tier) ◄───────────── AttackHotkeys (click + hotkeys)
  └─ currentAttack ──────────────► AttackHotkeys (highlight active row)
```

- No new server messages. Hurt/dead are derived entirely from HP state already broadcast.

## Edge Cases

- Fighter tier not in team → renders nothing.
- `duration` ≤ 0 or missing sheet → animator renders nothing gracefully.
- HP already 0 at mount → side mounts dead.
- Rapid successive hits → hurt restarts from frame 0.
- Dead is terminal — never returns to idle/standing.
- Opponent team unknown (`[]`) → renders nothing (unchanged).

## Testing

- `SpriteAnimator.test.tsx` — frame-count auto-detect from mocked image width, per-frame timing, loop/once/hold modes, onComplete firing, zero-width guard, restart on src change.
- `characterSprites.test.ts` — all 7 tiers have exactly the 5 sheets, durations > 0, `getRandomAttackAnim` returns a valid attack sheet.
- `BattleStage.test.tsx` — fighters render; active-tier fighter plays a random attack; HP drop triggers hurt on ALL 4 fighters of that side; HP 0 → all dead (hold); dead overrides hurt/attack; opponent mirroring; HP already 0 at mount.
- `AttackHotkeys.test.tsx` — renders only team tiers with hotkey + name, click calls onSelect, keyboard shortcut triggers onSelect, active row highlighted.
- Full client suite: `cd client && npm test && npm run lint && npm run build`.

## Out of Scope

- Server-side changes (none needed).
- Retouching the existing battleground parallax/zoom.
- Adding new animation states beyond idle/attack1/attack2/hurt/dead.
- TeamPicker / lobby UI changes.
