# Character Sprite Animations & Battle HUD Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static SVG battlefield sprites with frame-by-frame `SpriteAnimator` animations (idle/attack1/attack2/hurt/dead) driven by per-character sprite sheets, and replace the center attack selector with a compact clickable hotkey legend pinned to the bottom-right.

**Architecture:** 35 PNG sprite sheets (7 tiers × 5 states) live in `client/public/sprites/<tier>/<state>.png` (single-row strips of square 128×128 frames; frame count auto-detected as `naturalWidth / 128`). A `characterSprites.ts` manifest maps tier → sheets + total-duration-per-pass. `SpriteAnimator` plays sheets in three modes (`loop`/`once`/`hold`). `BattleStage` derives team-level states from HP props: attack on the active-tier fighter (random attack1/attack2), hurt on ALL fighters of a side when that side's HP drops, dead (hold last frame) on ALL fighters of a side at HP 0. `page.tsx` passes `playerHP`/`opponentHP` to `BattleStage` and swaps `AttackSelector` for the bottom-right `AttackHotkeys` legend.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Tailwind v4, Vitest + Testing Library (jsdom).

## Global Constraints

- Tier names are exactly: `'grunt' | 'archer' | 'paladin' | 'wizard' | 'cleric' | 'priest' | 'saint'`.
- Sprite sheets are 128px tall, single row, square 128×128 frames; `frameCount = naturalWidth / 128`.
- Path convention: `/sprites/<tier>/<state>.png` where state ∈ `idle | attack1 | attack2 | hurt | dead`.
- Animation modes: `idle` loops; `attack1`/`attack2`/`hurt` play once then return to idle; `dead` plays once then HOLDS the last frame (terminal, never returns to standing).
- Attack animation plays only on the active-tier fighter (one per side); hurt plays on ALL fighters of the hit side; dead plays on ALL fighters of the defeated side. Priority per fighter: `dead > hurt > attack > idle`.
- The attack selector legend shows ONLY hotkey + character name (no sprites/visuals) and is pinned bottom-right.
- Do not add code comments (project convention).
- Verify client changes with `cd client && npm test && npm run lint && npm run build`.

---

### Task 1: `characterSprites` manifest

**Files:**
- Create: `client/src/lib/characterSprites.ts`
- Test: `client/src/lib/characterSprites.test.ts`

**Interfaces:**
- Consumes: `Tier` from `client/src/lib/words.ts` (`export type Tier = 'grunt' | 'archer' | 'paladin' | 'wizard' | 'cleric' | 'priest' | 'saint'`).
- Produces:
  - `interface CharacterAnimation { idle: Sheet; attack1: Sheet; attack2: Sheet; hurt: Sheet; dead: Sheet }` with `interface Sheet { src: string; duration: number }`
  - `export const CHARACTER_ANIMATIONS: Record<Tier, CharacterAnimation>`
  - `export function getRandomAttackAnim(tier: Tier): Sheet` (50/50 attack1/attack2)
  - `export function getMaxHurtDuration(team: Tier[]): number`

- [ ] **Step 1: Write the failing test**

Create `client/src/lib/characterSprites.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CHARACTER_ANIMATIONS, getRandomAttackAnim, getMaxHurtDuration } from './characterSprites'

const TIERS = ['grunt', 'archer', 'paladin', 'wizard', 'cleric', 'priest', 'saint']
const STATES = ['idle', 'attack1', 'attack2', 'hurt', 'dead']

describe('characterSprites', () => {
  it('defines all 7 tiers with the 5 sheets at the canonical paths', () => {
    for (const tier of TIERS) {
      const anim = CHARACTER_ANIMATIONS[tier as keyof typeof CHARACTER_ANIMATIONS]
      expect(anim).toBeDefined()
      for (const state of STATES) {
        const sheet = anim[state as keyof typeof anim]
        expect(sheet.src).toBe(`/sprites/${tier}/${state}.png`)
      }
    }
  })

  it('gives every sheet a positive duration', () => {
    for (const tier of TIERS) {
      const anim = CHARACTER_ANIMATIONS[tier as keyof typeof CHARACTER_ANIMATIONS]
      for (const state of STATES) {
        expect(anim[state as keyof typeof anim].duration).toBeGreaterThan(0)
      }
    }
  })

  it('getRandomAttackAnim returns a valid attack sheet for the tier', () => {
    for (let i = 0; i < 50; i++) {
      const sheet = getRandomAttackAnim('grunt')
      expect(['/sprites/grunt/attack1.png', '/sprites/grunt/attack2.png']).toContain(sheet.src)
    }
  })

  it('getMaxHurtDuration returns the max hurt duration across the team', () => {
    expect(getMaxHurtDuration(['grunt', 'archer', 'paladin', 'cleric'])).toBe(400)
    expect(getMaxHurtDuration([])).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/characterSprites.test.ts`
Expected: FAIL with "Cannot find module './characterSprites'" (module does not exist yet).

- [ ] **Step 3: Write the manifest**

Create `client/src/lib/characterSprites.ts`:

```ts
import type { Tier } from './words'

export interface Sheet {
  src: string
  duration: number
}

export interface CharacterAnimation {
  idle: Sheet
  attack1: Sheet
  attack2: Sheet
  hurt: Sheet
  dead: Sheet
}

const sheet = (tier: Tier, state: 'idle' | 'attack1' | 'attack2' | 'hurt' | 'dead'): Sheet => ({
  src: `/sprites/${tier}/${state}.png`,
  duration: state === 'idle' ? 2000 : state === 'attack1' || state === 'attack2' ? 700 : state === 'hurt' ? 400 : 900,
})

export const CHARACTER_ANIMATIONS: Record<Tier, CharacterAnimation> = {
  grunt: {
    idle: sheet('grunt', 'idle'),
    attack1: sheet('grunt', 'attack1'),
    attack2: sheet('grunt', 'attack2'),
    hurt: sheet('grunt', 'hurt'),
    dead: sheet('grunt', 'dead'),
  },
  archer: {
    idle: sheet('archer', 'idle'),
    attack1: sheet('archer', 'attack1'),
    attack2: sheet('archer', 'attack2'),
    hurt: sheet('archer', 'hurt'),
    dead: sheet('archer', 'dead'),
  },
  paladin: {
    idle: sheet('paladin', 'idle'),
    attack1: sheet('paladin', 'attack1'),
    attack2: sheet('paladin', 'attack2'),
    hurt: sheet('paladin', 'hurt'),
    dead: sheet('paladin', 'dead'),
  },
  wizard: {
    idle: sheet('wizard', 'idle'),
    attack1: sheet('wizard', 'attack1'),
    attack2: sheet('wizard', 'attack2'),
    hurt: sheet('wizard', 'hurt'),
    dead: sheet('wizard', 'dead'),
  },
  cleric: {
    idle: sheet('cleric', 'idle'),
    attack1: sheet('cleric', 'attack1'),
    attack2: sheet('cleric', 'attack2'),
    hurt: sheet('cleric', 'hurt'),
    dead: sheet('cleric', 'dead'),
  },
  priest: {
    idle: sheet('priest', 'idle'),
    attack1: sheet('priest', 'attack1'),
    attack2: sheet('priest', 'attack2'),
    hurt: sheet('priest', 'hurt'),
    dead: sheet('priest', 'dead'),
  },
  saint: {
    idle: sheet('saint', 'idle'),
    attack1: sheet('saint', 'attack1'),
    attack2: sheet('saint', 'attack2'),
    hurt: sheet('saint', 'hurt'),
    dead: sheet('saint', 'dead'),
  },
}

export function getRandomAttackAnim(tier: Tier): Sheet {
  return Math.random() < 0.5 ? CHARACTER_ANIMATIONS[tier].attack1 : CHARACTER_ANIMATIONS[tier].attack2
}

export function getMaxHurtDuration(team: Tier[]): number {
  if (team.length === 0) return 400
  return Math.max(...team.map(t => CHARACTER_ANIMATIONS[t].hurt.duration))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/characterSprites.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/characterSprites.ts client/src/lib/characterSprites.test.ts
git commit -m "feat: add character sprite animation manifest"
```

---

### Task 2: `getFrameIndex` helper + `SpriteAnimator` component

**Files:**
- Create: `client/src/lib/spriteFrames.ts`
- Create: `client/src/components/battle/SpriteAnimator.tsx`
- Test: `client/src/lib/spriteFrames.test.ts`
- Test: `client/src/components/battle/SpriteAnimator.test.tsx`

**Interfaces:**
- Consumes: `Sheet` from `@/lib/characterSprites` (used by callers; `SpriteAnimator` takes `src`/`duration` primitives).
- Produces:
  - `export function getFrameIndex(elapsed: number, frameCount: number, duration: number, mode: 'loop' | 'once' | 'hold'): number`
  - `export default function SpriteAnimator({ src, alt, height, duration, mode, onComplete }: SpriteAnimatorProps)`

- [ ] **Step 1: Write the failing tests**

Create `client/src/lib/spriteFrames.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getFrameIndex } from './spriteFrames'

describe('getFrameIndex', () => {
  it('returns 0 for invalid input', () => {
    expect(getFrameIndex(100, 0, 700, 'loop')).toBe(0)
    expect(getFrameIndex(100, 5, 0, 'loop')).toBe(0)
  })

  it('loops forever', () => {
    expect(getFrameIndex(0, 5, 1000, 'loop')).toBe(0)
    expect(getFrameIndex(199, 5, 1000, 'loop')).toBe(0)
    expect(getFrameIndex(200, 5, 1000, 'loop')).toBe(1)
    expect(getFrameIndex(999, 5, 1000, 'loop')).toBe(4)
    expect(getFrameIndex(1000, 5, 1000, 'loop')).toBe(0)
    expect(getFrameIndex(1200, 5, 1000, 'loop')).toBe(1)
  })

  it('once and hold clamp to the last frame past the end', () => {
    expect(getFrameIndex(999, 5, 1000, 'once')).toBe(4)
    expect(getFrameIndex(5000, 5, 1000, 'once')).toBe(4)
    expect(getFrameIndex(5000, 5, 1000, 'hold')).toBe(4)
  })
})
```

Create `client/src/components/battle/SpriteAnimator.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SpriteAnimator from './SpriteAnimator'

function mockRaf() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now() + 16), 16) as unknown as number
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
}

function loadImage(alt: string, naturalWidth: number) {
  const img = screen.getByAltText(alt) as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true })
  fireEvent.load(img)
}

beforeEach(() => {
  vi.useFakeTimers()
  mockRaf()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SpriteAnimator', () => {
  it('auto-detects frame count from the loaded image width', () => {
    render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    loadImage('Grunt', 640)
    expect(screen.getByAltText('Grunt')).toHaveStyle('width: 640px')
  })

  it('uses a single frame width when the image is sub-frame', () => {
    render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    loadImage('Grunt', 100)
    expect(screen.getByAltText('Grunt')).toHaveStyle('width: 128px')
  })

  it('fires onComplete once in once mode', () => {
    const onComplete = vi.fn()
    render(<SpriteAnimator src="/sprites/grunt/attack1.png" alt="Grunt" duration={500} mode="once" onComplete={onComplete} />)
    loadImage('Grunt', 640)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('holds the last frame in hold mode without firing onComplete', () => {
    const onComplete = vi.fn()
    render(<SpriteAnimator src="/sprites/grunt/dead.png" alt="Grunt" duration={500} mode="hold" onComplete={onComplete} />)
    loadImage('Grunt', 640)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByAltText('Grunt')).toHaveStyle('transform: translateX(-512px)')
  })

  it('loops in loop mode', () => {
    render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    loadImage('Grunt', 640)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByAltText('Grunt')).toHaveStyle('transform: translateX(0px)')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/spriteFrames.test.ts src/components/battle/SpriteAnimator.test.tsx`
Expected: FAIL with "Cannot find module './spriteFrames'" / "Cannot find module './SpriteAnimator'".

- [ ] **Step 3: Write the helper**

Create `client/src/lib/spriteFrames.ts`:

```ts
export type AnimMode = 'loop' | 'once' | 'hold'

export function getFrameIndex(elapsed: number, frameCount: number, duration: number, mode: AnimMode): number {
  if (frameCount <= 0 || duration <= 0) return 0
  if (mode === 'loop') {
    const cycle = elapsed % duration
    return Math.min(Math.floor((cycle / duration) * frameCount), frameCount - 1)
  }
  const idx = Math.floor((elapsed / duration) * frameCount)
  return Math.min(idx, frameCount - 1)
}
```

- [ ] **Step 4: Write the component**

Create `client/src/components/battle/SpriteAnimator.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { getFrameIndex, type AnimMode } from '@/lib/spriteFrames'

interface SpriteAnimatorProps {
  src: string
  alt: string
  height?: number
  duration: number
  mode: AnimMode
  onComplete?: () => void
}

export default function SpriteAnimator({ src, alt, height = 128, duration, mode, onComplete }: SpriteAnimatorProps) {
  const [frameCount, setFrameCount] = useState(0)
  const [frameIndex, setFrameIndex] = useState(0)
  const onCompleteRef = useRef(onComplete)
  const firedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    setFrameIndex(0)
    firedRef.current = false
  }, [src])

  useEffect(() => {
    if (frameCount <= 0) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      if (mode === 'once' && elapsed >= duration) {
        setFrameIndex(frameCount - 1)
        if (!firedRef.current) {
          firedRef.current = true
          onCompleteRef.current?.()
        }
        return
      }
      if (mode === 'hold' && elapsed >= duration) {
        setFrameIndex(frameCount - 1)
        return
      }
      setFrameIndex(getFrameIndex(elapsed, frameCount, duration, mode))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [src, duration, mode, frameCount])

  return (
    <div style={{ width: height, height, overflow: 'hidden' }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={e => {
          const w = (e.currentTarget as HTMLImageElement).naturalWidth
          const count = Math.floor(w / 128)
          if (count > 0) setFrameCount(count)
        }}
        style={{
          width: frameCount > 0 ? frameCount * height : height,
          height,
          transform: `translateX(-${frameIndex * height}px)`,
          imageRendering: 'pixelated',
          opacity: frameCount > 0 ? 1 : 0,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/lib/spriteFrames.test.ts src/components/battle/SpriteAnimator.test.tsx`
Expected: PASS (3 + 5 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/spriteFrames.ts client/src/lib/spriteFrames.test.ts client/src/components/battle/SpriteAnimator.tsx client/src/components/battle/SpriteAnimator.test.tsx
git commit -m "feat: add sprite frame helper and SpriteAnimator component"
```

---

### Task 3: BattleStage team-level state machine (remove `FighterSprite`)

**Files:**
- Modify: `client/src/components/battle/BattleStage.tsx`
- Delete: `client/src/components/battle/FighterSprite.tsx`
- Delete: `client/src/components/battle/FighterSprite.test.tsx`
- Test: `client/src/components/battle/BattleStage.test.tsx`

**Interfaces:**
- Consumes: `CHARACTER_ANIMATIONS`, `getRandomAttackAnim`, `getMaxHurtDuration` from `@/lib/characterSprites`; `SpriteAnimator` from `./SpriteAnimator`; existing `ParallaxScene`, `BattleCamera`, `Battleground`, `Team`, `Tier`.
- Produces (new `BattleStageProps`):
  ```
  battleground: Battleground
  playerTeam: Team
  opponentTeam: Team
  activePlayerTier: Tier | null
  activeOpponentTier: Tier | null
  cameraMode: CameraMode
  playerHP: number
  opponentHP: number
  ```
  `resolveFocusSpot` keeps its existing signature and behavior.

- [ ] **Step 1: Write the failing tests**

Replace `client/src/components/battle/BattleStage.test.tsx` with:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleStage, { resolveFocusSpot } from './BattleStage'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'

const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']

function renderStage(overrides: Record<string, unknown> = {}) {
  return render(
    <BattleStage
      battleground={BATTLEGROUNDS.battleground1}
      playerTeam={TEAM_4}
      opponentTeam={TEAM_4}
      activePlayerTier={null}
      activeOpponentTier={null}
      cameraMode="wide"
      playerHP={1000}
      opponentHP={1000}
      {...overrides}
    />,
  )
}

function loadAllImages() {
  for (const img of screen.getAllByRole('img')) {
    Object.defineProperty(img, 'naturalWidth', { value: 512, configurable: true })
    fireEvent.load(img)
  }
}

describe('BattleStage', () => {
  it('renders both 4-member teams', () => {
    renderStage()
    loadAllImages()
    expect(screen.getAllByAltText(/grunt|archer|paladin|cleric/)).toHaveLength(8)
  })

  it('plays a random attack on the active player tier fighter', () => {
    renderStage({ activePlayerTier: 'grunt' })
    loadAllImages()
    const gruntImages = screen.getAllByAltText('grunt')
    const attacking = gruntImages.filter(img => /grunt\/attack[12]\.png/.test(img.getAttribute('src') || ''))
    expect(attacking).toHaveLength(1)
  })

  it('plays hurt on ALL player fighters when player HP drops', () => {
    const { rerender } = renderStage()
    loadAllImages()
    rerender(
      <BattleStage
        battleground={BATTLEGROUNDS.battleground1}
        playerTeam={TEAM_4}
        opponentTeam={TEAM_4}
        activePlayerTier={null}
        activeOpponentTier={null}
        cameraMode="wide"
        playerHP={600}
        opponentHP={1000}
      />,
    )
    const hurtImages = screen.getAllByRole('img').filter(img => /\/hurt\.png/.test(img.getAttribute('src') || ''))
    expect(hurtImages).toHaveLength(4)
  })

  it('plays dead on ALL opponent fighters when opponent HP reaches 0', () => {
    const { rerender } = renderStage()
    loadAllImages()
    rerender(
      <BattleStage
        battleground={BATTLEGROUNDS.battleground1}
        playerTeam={TEAM_4}
        opponentTeam={TEAM_4}
        activePlayerTier={null}
        activeOpponentTier={null}
        cameraMode="wide"
        playerHP={1000}
        opponentHP={0}
      />,
    )
    const deadImages = screen.getAllByRole('img').filter(img => /\/dead\.png/.test(img.getAttribute('src') || ''))
    expect(deadImages).toHaveLength(4)
  })

  it('mounts a side directly in dead when HP is already 0', () => {
    renderStage({ playerHP: 0, opponentHP: 1000 })
    loadAllImages()
    const deadImages = screen.getAllByRole('img').filter(img => /\/dead\.png/.test(img.getAttribute('src') || ''))
    expect(deadImages).toHaveLength(4)
  })

  it('resolves a focus spot from the active tier', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, TEAM_4, 'grunt', 'playerFocused')).toEqual({ x: 0.12, y: 0.78 })
  })

  it('falls back to the center-most spot when the active tier is not in the team', () => {
    const spot = resolveFocusSpot(BATTLEGROUNDS.battleground1, TEAM_4, 'wizard', 'playerFocused')
    expect(spot).toEqual(BATTLEGROUNDS.battleground1.playerTeam[1])
  })

  it('has no focus in wide mode', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, TEAM_4, 'grunt', 'wide')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/battle/BattleStage.test.tsx`
Expected: FAIL — the attack/hurt/dead behavior tests fail because the old `BattleStage` renders static `FighterSprite` images (all idle) and has no team-level animation logic (the "renders both 4-member teams" test may pass; the attack/hurt/dead tests fail). Note vitest transforms TS via esbuild, so extra props do not cause compile errors — the failure is behavioral.

- [ ] **Step 3: Rewrite `BattleStage`**

Replace the full contents of `client/src/components/battle/BattleStage.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Battleground, FighterSpot } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { CHARACTER_ANIMATIONS, getMaxHurtDuration, getRandomAttackAnim, type Sheet } from '@/lib/characterSprites'
import ParallaxScene from './ParallaxScene'
import BattleCamera from './BattleCamera'
import SpriteAnimator from './SpriteAnimator'

export type CameraMode = 'wide' | 'playerFocused'

interface BattleStageProps {
  battleground: Battleground
  playerTeam: Team
  opponentTeam: Team
  activePlayerTier: Tier | null
  activeOpponentTier: Tier | null
  cameraMode: CameraMode
  playerHP: number
  opponentHP: number
}

type AnimKind = 'idle' | 'attack' | 'hurt' | 'dead'

interface FighterResolved {
  sheet: Sheet
  kind: AnimKind
  key: string
}

export function resolveFocusSpot(
  battleground: Battleground,
  playerTeam: Team,
  activePlayerTier: Tier | null,
  cameraMode: CameraMode,
): FighterSpot | null {
  if (cameraMode !== 'playerFocused' || !activePlayerTier) return null
  const index = playerTeam.indexOf(activePlayerTier)
  if (index >= 0) return battleground.playerTeam[index]
  return battleground.playerTeam[1]
}

function resolveFighter(
  tier: Tier,
  team: Team,
  activeTier: Tier | null,
  attackSheet: Sheet | null,
  sideDead: boolean,
  sideHurt: boolean,
  hurtKey: number,
  attackDone: boolean,
): FighterResolved | null {
  if (!team.includes(tier)) return null
  const def = CHARACTER_ANIMATIONS[tier]
  if (sideDead) return { sheet: def.dead, kind: 'dead', key: `dead` }
  if (sideHurt) return { sheet: def.hurt, kind: 'hurt', key: `hurt-${hurtKey}` }
  if (tier === activeTier && attackSheet && !attackDone) {
    return { sheet: attackSheet, kind: 'attack', key: `attack` }
  }
  return { sheet: def.idle, kind: 'idle', key: `idle` }
}

function Fighter({
  tier,
  team,
  spot,
  activeTier,
  attackSheet,
  sideDead,
  sideHurt,
  hurtKey,
  mirror,
  prefix,
}: {
  tier: Tier
  team: Team
  spot: FighterSpot
  activeTier: Tier | null
  attackSheet: Sheet | null
  sideDead: boolean
  sideHurt: boolean
  hurtKey: number
  mirror: boolean
  prefix: string
}) {
  const [attackDone, setAttackDone] = useState(false)

  useEffect(() => {
    setAttackDone(false)
  }, [activeTier])

  const resolved = resolveFighter(tier, team, activeTier, attackSheet, sideDead, sideHurt, hurtKey, attackDone)
  if (!resolved) return null

  const mode = resolved.kind === 'dead' ? 'hold' : resolved.kind === 'idle' ? 'loop' : 'once'
  const onComplete = resolved.kind === 'attack' ? () => setAttackDone(true) : undefined

  return (
    <div
      className="absolute"
      style={{
        left: `${spot.x * 100}%`,
        top: `${spot.y * 100}%`,
        transform: `translate(-50%, -100%) ${mirror ? 'scaleX(-1)' : ''}`,
        zIndex: 10,
      }}
    >
      <SpriteAnimator
        key={`${prefix}-${tier}-${resolved.key}`}
        src={resolved.sheet.src}
        alt={tier}
        duration={resolved.sheet.duration}
        mode={mode}
        onComplete={onComplete}
      />
    </div>
  )
}

export default function BattleStage({
  battleground,
  playerTeam,
  opponentTeam,
  activePlayerTier,
  activeOpponentTier,
  cameraMode,
  playerHP,
  opponentHP,
}: BattleStageProps) {
  const focus = resolveFocusSpot(battleground, playerTeam, activePlayerTier, cameraMode)

  const playerAttackSheet = useMemo(
    () => (activePlayerTier ? getRandomAttackAnim(activePlayerTier) : null),
    [activePlayerTier],
  )
  const opponentAttackSheet = useMemo(
    () => (activeOpponentTier ? getRandomAttackAnim(activeOpponentTier) : null),
    [activeOpponentTier],
  )

  const playerDead = playerHP <= 0
  const opponentDead = opponentHP <= 0

  const prevPlayerHPRef = useRef(playerHP)
  const prevOpponentHPRef = useRef(opponentHP)
  const [playerHurtKey, setPlayerHurtKey] = useState(0)
  const [opponentHurtKey, setOpponentHurtKey] = useState(0)
  const [playerHurtActive, setPlayerHurtActive] = useState(false)
  const [opponentHurtActive, setOpponentHurtActive] = useState(false)

  useEffect(() => {
    const prev = prevPlayerHPRef.current
    prevPlayerHPRef.current = playerHP
    if (playerHP < prev) {
      setPlayerHurtActive(true)
      setPlayerHurtKey(k => k + 1)
      const t = setTimeout(() => setPlayerHurtActive(false), getMaxHurtDuration(playerTeam))
      return () => clearTimeout(t)
    }
  }, [playerHP, playerTeam])

  useEffect(() => {
    const prev = prevOpponentHPRef.current
    prevOpponentHPRef.current = opponentHP
    if (opponentHP < prev) {
      setOpponentHurtActive(true)
      setOpponentHurtKey(k => k + 1)
      const t = setTimeout(() => setOpponentHurtActive(false), getMaxHurtDuration(opponentTeam))
      return () => clearTimeout(t)
    }
  }, [opponentHP, opponentTeam])

  const renderTeam = (
    team: Team,
    spots: FighterSpot[],
    activeTier: Tier | null,
    attackSheet: Sheet | null,
    sideDead: boolean,
    sideHurt: boolean,
    hurtKey: number,
    mirror: boolean,
    prefix: string,
  ) =>
    team.map((tier, index) => (
      <Fighter
        key={`${prefix}-${tier}`}
        tier={tier}
        team={team}
        spot={spots[index]}
        activeTier={activeTier}
        attackSheet={attackSheet}
        sideDead={sideDead}
        sideHurt={sideHurt}
        hurtKey={hurtKey}
        mirror={mirror}
        prefix={prefix}
      />
    ))

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <BattleCamera focus={focus}>
        <ParallaxScene battleground={battleground} />
        <div className="absolute inset-0">
          {renderTeam(playerTeam, battleground.playerTeam, activePlayerTier, playerAttackSheet, playerDead, playerHurtActive, playerHurtKey, false, 'player')}
          {renderTeam(opponentTeam, battleground.opponentTeam, activeOpponentTier, opponentAttackSheet, opponentDead, opponentHurtActive, opponentHurtKey, true, 'opponent')}
        </div>
      </BattleCamera>
    </div>
  )
}
```

- [ ] **Step 4: Delete the old fighter component**

```bash
rm client/src/components/battle/FighterSprite.tsx client/src/components/battle/FighterSprite.test.tsx
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/battle/BattleStage.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/battle/BattleStage.tsx client/src/components/battle/BattleStage.test.tsx
git rm client/src/components/battle/FighterSprite.tsx client/src/components/battle/FighterSprite.test.tsx
git commit -m "feat: drive field fighters with sprite animation states"
```

---

### Task 4: `AttackHotkeys` component (remove `AttackSelector`)

**Files:**
- Create: `client/src/components/battle/AttackHotkeys.tsx`
- Delete: `client/src/components/AttackSelector.tsx`
- Delete: `client/src/components/AttackSelector.test.tsx`
- Test: `client/src/components/battle/AttackHotkeys.test.tsx`

**Interfaces:**
- Consumes: `Team` from `@/lib/team`, `Tier` from `@/lib/words`, `TIERS` from `@/lib/tiers`.
- Produces:
  ```
  interface AttackHotkeysProps {
    team: Team
    currentAttack: string
    onSelect: (tier: Tier) => void
    disabled?: boolean
  }
  export default function AttackHotkeys(props: AttackHotkeysProps)
  ```

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/battle/AttackHotkeys.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AttackHotkeys from './AttackHotkeys'
import type { Team } from '@/lib/team'

const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']

describe('AttackHotkeys', () => {
  it('renders only team members with hotkey and name', () => {
    render(<AttackHotkeys team={TEAM_4} currentAttack="" onSelect={vi.fn()} />)
    expect(screen.getByText('[1]')).toBeInTheDocument()
    expect(screen.getByText('Grunt')).toBeInTheDocument()
    expect(screen.getByText('[2]')).toBeInTheDocument()
    expect(screen.getByText('Archer')).toBeInTheDocument()
    expect(screen.queryByText('Wizard')).not.toBeInTheDocument()
    expect(screen.queryByText('Saint')).not.toBeInTheDocument()
  })

  it('calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn()
    render(<AttackHotkeys team={TEAM_4} currentAttack="" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onSelect).toHaveBeenCalledWith('grunt')
  })

  it('triggers onSelect via hotkeys for team members only', () => {
    const onSelect = vi.fn()
    render(<AttackHotkeys team={TEAM_4} currentAttack="" onSelect={onSelect} />)
    fireEvent.keyDown(window, { key: '1' })
    expect(onSelect).toHaveBeenCalledWith('grunt')
    fireEvent.keyDown(window, { key: '4' })
    expect(onSelect).not.toHaveBeenCalledWith('wizard')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('highlights the current attack row', () => {
    render(<AttackHotkeys team={TEAM_4} currentAttack="archer" onSelect={vi.fn()} />)
    const row = screen.getByText('Archer').closest('button')
    expect(row).toHaveClass('ring-2')
  })

  it('renders nothing for an empty team', () => {
    render(<AttackHotkeys team={[]} currentAttack="" onSelect={vi.fn()} />)
    expect(screen.queryByText('Grunt')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/battle/AttackHotkeys.test.tsx`
Expected: FAIL with "Cannot find module './AttackHotkeys'".

- [ ] **Step 3: Write the component**

Create `client/src/components/battle/AttackHotkeys.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { TIERS } from '@/lib/tiers'

interface AttackHotkeysProps {
  team: Team
  currentAttack: string
  onSelect: (tier: Tier) => void
  disabled?: boolean
}

export default function AttackHotkeys({ team, currentAttack, onSelect, disabled }: AttackHotkeysProps) {
  useEffect(() => {
    if (disabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const action = TIERS.find(a => a.shortcut === e.key && team.includes(a.tier))
      if (action) onSelect(action.tier)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelect, disabled, team])

  const visible = TIERS.filter(a => team.includes(a.tier))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-700/40 bg-black/40 backdrop-blur-sm p-2">
      {visible.map(a => {
        const isActive = currentAttack === a.tier
        return (
          <button
            key={a.tier}
            type="button"
            onClick={() => onSelect(a.tier)}
            disabled={disabled}
            className={`flex items-center gap-2 rounded px-2 py-1 text-left text-sm transition-all ${
              isActive
                ? 'bg-gray-700 ring-2 ring-gray-400'
                : 'bg-gray-900 hover:bg-gray-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="w-5 text-xs text-gray-400">[{a.shortcut}]</span>
            <span className="font-bold" style={{ color: a.color }}>
              {a.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Delete the old selector**

```bash
rm client/src/components/AttackSelector.tsx client/src/components/AttackSelector.test.tsx
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/battle/AttackHotkeys.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/battle/AttackHotkeys.tsx client/src/components/battle/AttackHotkeys.test.tsx
git rm client/src/components/AttackSelector.tsx client/src/components/AttackSelector.test.tsx
git commit -m "feat: add bottom-right attack hotkey legend"
```

---

### Task 5: Wire `page.tsx`, clean `tiers.ts`, switch `TeamPicker`

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`
- Modify: `client/src/lib/tiers.ts`
- Modify: `client/src/components/TeamPicker.tsx`

**Interfaces:**
- Consumes: `BattleStage` new props (from Task 3), `AttackHotkeys` (from Task 4), `CHARACTER_ANIMATIONS` from `@/lib/characterSprites`.
- Produces: `tiers.ts` exports only `TierInfo`, `TIERS`, `TIER_MAP`, `getTierInfo` (drops `SPRITE_MAP` and `getSpritePath`).

- [ ] **Step 1: Clean `tiers.ts`**

Remove from `client/src/lib/tiers.ts` the `SPRITE_MAP` constant and the `getSpritePath` function. The file keeps `TIERS`, `TIER_MAP`, `getTierInfo`, and the `TierInfo` interface. After removal it ends with `getTierInfo`:

```ts
export function getTierInfo(tier: string | null | undefined): TierInfo | undefined {
  if (!tier) return undefined
  return TIER_MAP[tier as Tier]
}
```

- [ ] **Step 2: Update `TeamPicker.tsx`**

Change the import at line 6 and the sprite usage so the picker uses the new idle sheets:

```tsx
import { TIERS } from '@/lib/tiers'
import { CHARACTER_ANIMATIONS } from '@/lib/characterSprites'
```

Replace the `<Image src={getSpritePath(c.tier)} ...>` prop with:

```tsx
src={CHARACTER_ANIMATIONS[c.tier].idle.src}
```

- [ ] **Step 3: Update `page.tsx` imports**

In `client/src/app/room/[id]/page.tsx`:
- Remove `import AttackSelector from '@/components/AttackSelector'`
- Add `import AttackHotkeys from '@/components/battle/AttackHotkeys'`

- [ ] **Step 4: Pass HP to `BattleStage`**

In the `BattleStage` JSX (around line 553), add the two new props:

```tsx
playerHP={playerHP}
opponentHP={opponentHP}
```

- [ ] **Step 5: Replace the attack selector block**

Replace the `AttackSelector` block (currently lines 742-753):

```tsx
{(gameState === 'countdown' || gameState === 'playing') && (
  <div className="mt-6 flex justify-center">
    <div className="rounded-xl border border-gray-700/40 bg-black/40 backdrop-blur-sm p-3">
      <AttackSelector
        onSelect={handleSelectAttack}
        currentAttack={currentAttack}
        disabled={gameState !== 'playing'}
        team={playerTeam}
      />
    </div>
  </div>
)}
```

with:

```tsx
{(gameState === 'countdown' || gameState === 'playing') && (
  <div className="fixed bottom-4 right-4 z-20">
    <AttackHotkeys
      team={playerTeam}
      currentAttack={currentAttack}
      onSelect={handleSelectAttack}
      disabled={gameState !== 'playing'}
    />
  </div>
)}
```

- [ ] **Step 6: Run the full client suite**

Run: `cd client && npm test && npm run lint && npm run build`
Expected: all tests pass, lint 0 errors (pre-existing warnings acceptable), build succeeds. Confirm no remaining imports of `AttackSelector`, `SPRITE_MAP`, or `getSpritePath` in `client/src`:

```bash
cd client && grep -rn "AttackSelector\|SPRITE_MAP\|getSpritePath" src/ || echo "clean"
```

- [ ] **Step 7: Commit**

```bash
git add client/src/app/room/[id]/page.tsx client/src/lib/tiers.ts client/src/components/TeamPicker.tsx
git commit -m "feat: wire sprite animations and hotkey legend into the room page"
```

---

### Task 6: Place sprite assets + full verification

**Files:**
- Create: `client/public/sprites/<tier>/<state>.png` (35 files) — the user-provided PNG sheets
- Test: full client suite

**Interfaces:**
- Consumes: the 35 PNG sheets the user is pasting (each 128px tall, single-row strip of square 128×128 frames).

- [ ] **Step 1: Place the assets**

Create the 7 per-character directories and move/copy the user-provided PNGs into place. The expected final layout:

```
client/public/sprites/grunt/idle.png
client/public/sprites/grunt/attack1.png
client/public/sprites/grunt/attack2.png
client/public/sprites/grunt/hurt.png
client/public/sprites/grunt/dead.png
client/public/sprites/archer/...   (same 5)
client/public/sprites/paladin/... (same 5)
client/public/sprites/wizard/...  (same 5)
client/public/sprites/cleric/...  (same 5)
client/public/sprites/priest/...  (same 5)
client/public/sprites/saint/...   (same 5)
```

If the pasted files arrive under a different name/location, move them to the canonical paths above. Remove the retired flat SVGs from `client/public/sprites/` (the `*_idle.svg` / `*_attack.svg` files) unless they are still referenced.

- [ ] **Step 2: Verify the sheet dimensions**

For each of the 35 files, confirm the PNG is 128px tall and its width is a whole multiple of 128 (i.e. `width % 128 === 0`). Use `file` or `identify`/`python` as available; report any sheet that violates the format.

- [ ] **Step 3: Run the full client suite**

Run: `cd client && npm test && npm run lint && npm run build`
Expected: all pass. `npm run build` must succeed with the new assets in `public/`.

- [ ] **Step 4: Manual browser smoke test (user step)**

Start the dev servers (`cd server && make dev` and `cd client && npm run dev`), play a full match in the browser, and verify:
- Fighters animate: idle loops, the selected attack plays attack1/attack2 at random, the hit side's 4 fighters play hurt, the defeated side's 4 fighters play dead and hold the last frame.
- The bottom-right legend shows only the team's hotkeys + names, is clickable, and highlights the active attack.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add client/public/sprites
git rm client/public/sprites/*_idle.svg client/public/sprites/*_attack.svg
git commit -m "build: add character sprite sheets"
```
