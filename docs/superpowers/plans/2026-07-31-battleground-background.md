# Battleground Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen, dynamic parallax battleground with team fighters and a camera that zooms on attack selection, driven by a manifest so new battlegrounds can be added without code changes.

**Architecture:** A typed `BATTLEGROUNDS` manifest declares layers (image, speed, anchor) and fighter spots per battleground. A `ParallaxScene` renders each layer as a 200%-wide track with two copies and pans it via one `requestAnimationFrame` loop. A `BattleCamera` wrapper applies `scale` + `transform-origin` (CSS transition) to zoom toward the active fighter. Teams come from a localStorage-backed `team.ts` (default 4). The server picks a random battleground id and sends it in `game_setup`.

**Tech Stack:** Next.js 15 / React 19 / TypeScript (client), Go 1.22 + gorilla/websocket (server), Tailwind v4, Vitest + Testing Library (client tests), Go stdlib `testing` (server tests).

## Global Constraints

- No game engine or animation libraries (no PixiJS, Phaser, framer-motion, GSAP). All motion is CSS transforms + `requestAnimationFrame`.
- Parallax layers are plain `<img>` elements (not `next/image`), `draggable={false}`.
- Tier names are exactly: `'grunt' | 'archer' | 'paladin' | 'wizard' | 'cleric' | 'priest' | 'saint'`.
- A team is exactly 4 tiers, no duplicates.
- Camera zoom scale is `1.12`, transition `500ms cubic-bezier(.22,.9,.35,1)`.
- Battleground ids are strings; server picks from its `battlegrounds` list; client falls back to `battleground1`.
- Asset files live under `client/public/battlegrounds/<battlegroundId>/`.
- Do not add code comments (project convention).
- Verify with `cd client && npm run lint && npm test && npm run build` and `cd server && go test ./...`.

---

### Task 1: Battleground manifest + asset folder

**Files:**
- Create: `client/src/lib/battlegrounds.ts`
- Test: `client/src/lib/battlegrounds.test.ts`
- Create: `client/public/battlegrounds/battleground1/.gitkeep`

**Interfaces:**
- Produces: `type LayerAnchor`, `interface ParallaxLayer`, `interface FighterSpot`, `interface Battleground`, `const BATTLEGROUNDS: Record<string, Battleground>`, `function getBattleground(id: string | undefined): Battleground`, `function validateBattleground(bg: Battleground): string[]`.

- [ ] **Step 1: Write the failing test**

Create `client/src/lib/battlegrounds.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BATTLEGROUNDS, getBattleground, validateBattleground } from './battlegrounds'

describe('battlegrounds manifest', () => {
  it('has a valid battleground1 entry', () => {
    const bg = BATTLEGROUNDS.battleground1
    expect(bg).toBeDefined()
    expect(validateBattleground(bg)).toEqual([])
  })

  it('looks up an id and falls back to battleground1 for unknown/missing ids', () => {
    expect(getBattleground('battleground1').id).toBe('battleground1')
    expect(getBattleground('nope').id).toBe('battleground1')
    expect(getBattleground(undefined).id).toBe('battleground1')
  })

  it('rejects an out-of-range layer speed', () => {
    const bg = {
      ...BATTLEGROUNDS.battleground1,
      layers: [{ ...BATTLEGROUNDS.battleground1.layers[0], speed: 2 }],
    }
    expect(validateBattleground(bg).length).toBeGreaterThan(0)
  })

  it('rejects a team without exactly 4 spots', () => {
    const bg = { ...BATTLEGROUNDS.battleground1, playerTeam: [] }
    expect(validateBattleground(bg).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/battlegrounds.test.ts`
Expected: FAIL (module `./battlegrounds` cannot be resolved).

- [ ] **Step 3: Write the manifest**

Create `client/src/lib/battlegrounds.ts`:

```ts
export type LayerAnchor = 'top' | 'center' | 'bottom'

export interface ParallaxLayer {
  id: string
  image: string
  speed: number
  anchor: LayerAnchor
}

export interface FighterSpot {
  x: number
  y: number
}

export interface Battleground {
  id: string
  name: string
  layers: ParallaxLayer[]
  playerTeam: FighterSpot[]
  opponentTeam: FighterSpot[]
}

export const BATTLEGROUNDS: Record<string, Battleground> = {
  battleground1: {
    id: 'battleground1',
    name: 'Ancient Ruins',
    layers: [
      { id: 'sky', image: '/battlegrounds/battleground1/sky.png', speed: 0.0, anchor: 'top' },
      { id: 'ruins-bg', image: '/battlegrounds/battleground1/ruins-bg.png', speed: 0.08, anchor: 'bottom' },
      { id: 'ruins2', image: '/battlegrounds/battleground1/ruins2.png', speed: 0.18, anchor: 'bottom' },
      { id: 'ruins', image: '/battlegrounds/battleground1/ruins.png', speed: 0.32, anchor: 'bottom' },
      { id: 'hill-trees', image: '/battlegrounds/battleground1/hill-trees.png', speed: 0.5, anchor: 'bottom' },
      { id: 'statue', image: '/battlegrounds/battleground1/statue.png', speed: 0.72, anchor: 'bottom' },
      { id: 'stones-grass', image: '/battlegrounds/battleground1/stones-grass.png', speed: 1.0, anchor: 'bottom' },
    ],
    playerTeam: [
      { x: 0.12, y: 0.78 },
      { x: 0.2, y: 0.78 },
      { x: 0.28, y: 0.78 },
      { x: 0.36, y: 0.78 },
    ],
    opponentTeam: [
      { x: 0.64, y: 0.78 },
      { x: 0.72, y: 0.78 },
      { x: 0.8, y: 0.78 },
      { x: 0.88, y: 0.78 },
    ],
  },
}

export function getBattleground(id: string | undefined): Battleground {
  return (id && BATTLEGROUNDS[id]) || BATTLEGROUNDS.battleground1
}

export function validateBattleground(battleground: Battleground): string[] {
  const errors: string[] = []
  if (battleground.layers.length === 0) errors.push('must have at least one layer')
  for (const layer of battleground.layers) {
    if (layer.speed < 0 || layer.speed > 1) errors.push(`layer "${layer.id}" speed must be 0-1`)
    if (!layer.image.startsWith('/battlegrounds/')) errors.push(`layer "${layer.id}" image must be under /battlegrounds/`)
    if (layer.anchor !== 'top' && layer.anchor !== 'center' && layer.anchor !== 'bottom') {
      errors.push(`layer "${layer.id}" has an invalid anchor`)
    }
  }
  if (battleground.playerTeam.length !== 4) errors.push('playerTeam must have exactly 4 spots')
  if (battleground.opponentTeam.length !== 4) errors.push('opponentTeam must have exactly 4 spots')
  return errors
}
```

- [ ] **Step 4: Create the asset folder**

Run: `mkdir -p client/public/battlegrounds/battleground1 && touch client/public/battlegrounds/battleground1/.gitkeep`

Expected: folder exists. The actual PNGs will be dropped here in Task 11 (they are not in the repo yet).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/battlegrounds.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/battlegrounds.ts client/src/lib/battlegrounds.test.ts client/public/battlegrounds/battleground1/.gitkeep
git commit -m "feat: add battleground manifest with battleground1"
```

---

### Task 2: Team persistence in localStorage

**Files:**
- Modify: `client/src/lib/words.ts:1` (export the `Tier` type)
- Create: `client/src/lib/team.ts`
- Test: `client/src/lib/team.test.ts`

**Interfaces:**
- Consumes: `type Tier` from `./words`.
- Produces: `type Team = Tier[]`, `const DEFAULT_TEAM: Team`, `function getTeam(): Team`, `function saveTeam(team: Team): void`, `function isValidTeam(value: unknown): value is Team`.

- [ ] **Step 1: Export the Tier type**

In `client/src/lib/words.ts`, change line 1 from:

```ts
type Tier = 'grunt' | 'archer' | 'paladin' | 'wizard' | 'cleric' | 'priest' | 'saint'
```

to:

```ts
export type Tier = 'grunt' | 'archer' | 'paladin' | 'wizard' | 'cleric' | 'priest' | 'saint'
```

- [ ] **Step 2: Write the failing test**

Create `client/src/lib/team.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getTeam, saveTeam, isValidTeam, DEFAULT_TEAM } from './team'

beforeEach(() => localStorage.clear())

describe('team persistence', () => {
  it('returns the default team when nothing is stored', () => {
    expect(getTeam()).toEqual(DEFAULT_TEAM)
  })

  it('round-trips a saved team', () => {
    saveTeam(['archer', 'paladin', 'wizard', 'saint'])
    expect(getTeam()).toEqual(['archer', 'paladin', 'wizard', 'saint'])
  })

  it('falls back to default on corrupt JSON', () => {
    localStorage.setItem('typefight_team', 'not json')
    expect(getTeam()).toEqual(DEFAULT_TEAM)
  })

  it('falls back to default on an invalid team', () => {
    localStorage.setItem('typefight_team', JSON.stringify(['grunt', 'archer']))
    expect(getTeam()).toEqual(DEFAULT_TEAM)
  })

  it('validates a team shape', () => {
    expect(isValidTeam(['grunt', 'archer', 'paladin', 'cleric'])).toBe(true)
    expect(isValidTeam(['grunt'])).toBe(false)
    expect(isValidTeam(['grunt', 'grunt', 'grunt', 'grunt'])).toBe(false)
    expect(isValidTeam('nope')).toBe(false)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/team.test.ts`
Expected: FAIL (module `./team` cannot be resolved).

- [ ] **Step 4: Write the team module**

Create `client/src/lib/team.ts`:

```ts
import type { Tier } from './words'

export type Team = Tier[]

export const DEFAULT_TEAM: Team = ['grunt', 'archer', 'paladin', 'cleric']

const STORAGE_KEY = 'typefight_team'
const TEAM_SIZE = 4

const VALID_TIERS: Tier[] = ['grunt', 'archer', 'paladin', 'wizard', 'cleric', 'priest', 'saint']

export function isValidTeam(value: unknown): value is Team {
  return (
    Array.isArray(value) &&
    value.length === TEAM_SIZE &&
    value.every(tier => VALID_TIERS.includes(tier as Tier))
  )
}

export function getTeam(): Team {
  if (typeof window === 'undefined') return [...DEFAULT_TEAM]
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return [...DEFAULT_TEAM]
  try {
    const parsed = JSON.parse(data)
    return isValidTeam(parsed) ? parsed : [...DEFAULT_TEAM]
  } catch {
    return [...DEFAULT_TEAM]
  }
}

export function saveTeam(team: Team): void {
  if (!isValidTeam(team)) throw new Error('Team must contain exactly 4 valid tiers')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(team))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/team.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/words.ts client/src/lib/team.ts client/src/lib/team.test.ts
git commit -m "feat: add localStorage team persistence with default team"
```

---

### Task 3: Sprite map + FighterSprite component

**Files:**
- Create: `client/src/lib/sprites.ts`
- Create: `client/src/components/battle/FighterSprite.tsx`
- Test: `client/src/components/battle/FighterSprite.test.tsx`
- Modify: `client/src/app/globals.css` (add `fighter-bob` keyframe)

**Interfaces:**
- Consumes: `type Tier` from `@/lib/words`.
- Produces: `const SPRITE_MAP: Record<Tier, string>`, `interface FighterSpriteProps`, `default function FighterSprite({ src, alt, active, size })`.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/battle/FighterSprite.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import FighterSprite from './FighterSprite'

describe('FighterSprite', () => {
  it('renders the fighter image', () => {
    render(<FighterSprite src="/sprites/grunt_idle.svg" alt="Grunt" active={false} />)
    const img = screen.getByAltText('Grunt')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/sprites/grunt_idle.svg')
    expect(img).toHaveAttribute('draggable', 'false')
  })

  it('shows the active highlight ring', () => {
    const { container } = render(<FighterSprite src="/sprites/grunt_idle.svg" alt="Grunt" active />)
    expect(container.querySelector('img')).toHaveStyle('outline: 3px solid #fbbf24')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/battle/FighterSprite.test.tsx`
Expected: FAIL (module `./FighterSprite` cannot be resolved).

- [ ] **Step 3: Write the sprite map**

Create `client/src/lib/sprites.ts`:

```ts
import type { Tier } from './words'

export const SPRITE_MAP: Record<Tier, string> = {
  grunt: '/sprites/grunt_idle.svg',
  archer: '/sprites/archer_idle.svg',
  paladin: '/sprites/paladin_idle.svg',
  wizard: '/sprites/wizard_idle.svg',
  cleric: '/sprites/cleric_idle.svg',
  priest: '/sprites/priest_idle.svg',
  saint: '/sprites/saint_idle.svg',
}
```

- [ ] **Step 4: Write the FighterSprite component**

Create `client/src/components/battle/FighterSprite.tsx`:

```tsx
'use client'

interface FighterSpriteProps {
  src: string
  alt: string
  active: boolean
  size?: number
}

export default function FighterSprite({ src, alt, active, size = 160 }: FighterSpriteProps) {
  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        animation: 'fighter-bob 2s ease-in-out infinite',
      }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        className="w-full h-full object-contain select-none"
        style={
          active
            ? { outline: '3px solid #fbbf24', borderRadius: 12, filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.8))' }
            : undefined
        }
      />
    </div>
  )
}
```

- [ ] **Step 5: Add the idle-bob keyframe**

In `client/src/app/globals.css`, append at the end of the file:

```css
@keyframes fighter-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/battle/FighterSprite.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/sprites.ts client/src/components/battle/FighterSprite.tsx client/src/components/battle/FighterSprite.test.tsx client/src/app/globals.css
git commit -m "feat: add fighter sprite component with idle bob and active highlight"
```

---

### Task 4: Parallax loop helpers + ParallaxScene component

**Files:**
- Create: `client/src/components/battle/parallax.ts`
- Test: `client/src/components/battle/parallax.test.ts`
- Create: `client/src/components/battle/ParallaxScene.tsx`
- Test: `client/src/components/battle/ParallaxScene.test.tsx`

**Interfaces:**
- Consumes: `type Battleground` from `@/lib/battlegrounds`.
- Produces: `const PAN_SPEED` (px per ms, `0.03`), `function advanceParallaxOffset(prevOffset: number, elapsedMs: number, viewportWidth: number): number`, `function layerTranslate(layerSpeed: number, baseOffset: number): string`, `interface ParallaxSceneProps`, `default function ParallaxScene({ battleground, running }: ParallaxSceneProps)`.

- [ ] **Step 1: Write the failing helper test**

Create `client/src/components/battle/parallax.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { advanceParallaxOffset, layerTranslate, PAN_SPEED } from './parallax'

describe('parallax helpers', () => {
  it('advances the offset by elapsed time', () => {
    expect(advanceParallaxOffset(0, 1000, 1920)).toBeCloseTo(1000 * PAN_SPEED)
  })

  it('wraps at one viewport width', () => {
    const next = advanceParallaxOffset(1900, 2000, 1920)
    expect(next).toBeGreaterThanOrEqual(0)
    expect(next).toBeLessThan(1920)
  })

  it('stays at 0 when the viewport width is invalid', () => {
    expect(advanceParallaxOffset(100, 1000, 0)).toBe(0)
  })

  it('builds a translate3d transform scaled by layer speed', () => {
    expect(layerTranslate(0, 100)).toBe('translate3d(-0.00px, 0, 0)')
    expect(layerTranslate(1, 100)).toBe('translate3d(-100.00px, 0, 0)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/battle/parallax.test.ts`
Expected: FAIL (module `./parallax` cannot be resolved).

- [ ] **Step 3: Write the loop helpers**

Create `client/src/components/battle/parallax.ts`:

```ts
export const PAN_SPEED = 0.03

export function advanceParallaxOffset(prevOffset: number, elapsedMs: number, viewportWidth: number): number {
  if (viewportWidth <= 0) return 0
  return (prevOffset + elapsedMs * PAN_SPEED) % viewportWidth
}

export function layerTranslate(layerSpeed: number, baseOffset: number): string {
  return `translate3d(${(-baseOffset * layerSpeed).toFixed(2)}px, 0, 0)`
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run: `cd client && npx vitest run src/components/battle/parallax.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Write the failing component test**

Create `client/src/components/battle/ParallaxScene.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ParallaxScene from './ParallaxScene'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'

describe('ParallaxScene', () => {
  it('renders two tiled copies of every layer', () => {
    render(<ParallaxScene battleground={BATTLEGROUNDS.battleground1} running={false} />)
    expect(screen.getAllByRole('img').length).toBe(BATTLEGROUNDS.battleground1.layers.length * 2)
  })
})
```

- [ ] **Step 6: Run component test to verify it fails**

Run: `cd client && npx vitest run src/components/battle/ParallaxScene.test.tsx`
Expected: FAIL (module `./ParallaxScene` cannot be resolved).

- [ ] **Step 7: Write the ParallaxScene component**

Create `client/src/components/battle/ParallaxScene.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { Battleground } from '@/lib/battlegrounds'
import { advanceParallaxOffset, layerTranslate } from './parallax'

interface ParallaxSceneProps {
  battleground: Battleground
  running: boolean
}

export default function ParallaxScene({ battleground, running }: ParallaxSceneProps) {
  const offsetRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const trackRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!running) {
      lastTimeRef.current = null
      return
    }

    let frameId: number
    const loop = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time
      }
      const elapsed = time - lastTimeRef.current
      lastTimeRef.current = time
      const viewportWidth = window.innerWidth
      offsetRef.current = advanceParallaxOffset(offsetRef.current, elapsed, viewportWidth)
      trackRefs.current.forEach((track, index) => {
        if (track) {
          const speed = battleground.layers[index]?.speed ?? 0
          track.style.transform = layerTranslate(speed, offsetRef.current)
        }
      })
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [running, battleground])

  const anchorClass = (anchor: 'top' | 'center' | 'bottom') =>
    anchor === 'top' ? 'object-top' : anchor === 'bottom' ? 'object-bottom' : 'object-center'

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {battleground.layers.map((layer, index) => (
        <div
          key={layer.id}
          ref={el => { trackRefs.current[index] = el }}
          className="absolute top-0 left-0 h-full w-[200%] flex will-change-transform"
          style={{ zIndex: index }}
        >
          {[0, 1].map(copy => (
            <img
              key={copy}
              src={layer.image}
              alt=""
              draggable={false}
              className={`w-1/2 h-full object-cover ${anchorClass(layer.anchor)}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Run component test to verify it passes**

Run: `cd client && npx vitest run src/components/battle/ParallaxScene.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add client/src/components/battle/parallax.ts client/src/components/battle/parallax.test.ts client/src/components/battle/ParallaxScene.tsx client/src/components/battle/ParallaxScene.test.tsx
git commit -m "feat: add parallax scene with tiled layers and rAF pan loop"
```

---

### Task 5: BattleCamera component

**Files:**
- Create: `client/src/components/battle/BattleCamera.tsx`
- Test: `client/src/components/battle/BattleCamera.test.tsx`

**Interfaces:**
- Consumes: `type FighterSpot` from `@/lib/battlegrounds`.
- Produces: `interface BattleCameraProps`, `default function BattleCamera({ focus, children }: BattleCameraProps)`.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/battle/BattleCamera.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleCamera from './BattleCamera'

describe('BattleCamera', () => {
  it('sits at scale 1 centered by default', () => {
    const { container } = render(<BattleCamera focus={null}><div /></BattleCamera>)
    const div = container.firstChild as HTMLElement
    expect(div).toHaveStyle('transform: scale(1)')
    expect(div).toHaveStyle('transform-origin: 50% 50%')
  })

  it('zooms toward the focus spot', () => {
    const { container } = render(<BattleCamera focus={{ x: 0.2, y: 0.78 }}><div /></BattleCamera>)
    const div = container.firstChild as HTMLElement
    expect(div).toHaveStyle('transform: scale(1.12)')
    expect(div).toHaveStyle('transform-origin: 20% 78%')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/battle/BattleCamera.test.tsx`
Expected: FAIL (module `./BattleCamera` cannot be resolved).

- [ ] **Step 3: Write the BattleCamera component**

Create `client/src/components/battle/BattleCamera.tsx`:

```tsx
'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { FighterSpot } from '@/lib/battlegrounds'

const ZOOM_SCALE = 1.12

interface BattleCameraProps {
  focus: FighterSpot | null
  children: ReactNode
}

export default function BattleCamera({ focus, children }: BattleCameraProps) {
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    transform: focus ? `scale(${ZOOM_SCALE})` : 'scale(1)',
    transformOrigin: focus ? `${focus.x * 100}% ${focus.y * 100}%` : '50% 50%',
    transition: 'transform 500ms cubic-bezier(.22,.9,.35,1)',
    willChange: 'transform',
  }
  return <div style={style}>{children}</div>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/battle/BattleCamera.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/battle/BattleCamera.tsx client/src/components/battle/BattleCamera.test.tsx
git commit -m "feat: add battle camera with focus zoom"
```

---

### Task 6: BattleStage component

**Files:**
- Create: `client/src/components/battle/BattleStage.tsx`
- Test: `client/src/components/battle/BattleStage.test.tsx`

**Interfaces:**
- Consumes: `type Battleground`, `type FighterSpot` from `@/lib/battlegrounds`; `type Team` from `@/lib/team`; `type Tier` from `@/lib/words`; `SPRITE_MAP` from `@/lib/sprites`; `ParallaxScene`, `BattleCamera`, `FighterSprite` from earlier tasks.
- Produces: `type CameraMode = 'wide' | 'playerFocused'`, `interface BattleStageProps`, `function resolveFocusSpot(battleground, playerTeam, activePlayerTier, cameraMode): FighterSpot | null`, `default function BattleStage(props: BattleStageProps)`.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/battle/BattleStage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleStage, { resolveFocusSpot } from './BattleStage'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'
import { DEFAULT_TEAM } from '@/lib/team'

describe('BattleStage', () => {
  it('renders both 4-member teams over the scene', () => {
    render(
      <BattleStage
        battleground={BATTLEGROUNDS.battleground1}
        running={false}
        playerTeam={DEFAULT_TEAM}
        opponentTeam={DEFAULT_TEAM}
        activePlayerTier={null}
        activeOpponentTier={null}
        cameraMode="wide"
      />
    )
    expect(screen.getAllByAltText(/grunt|archer|paladin|cleric/)).toHaveLength(8)
  })

  it('resolves a focus spot from the active tier', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, DEFAULT_TEAM, 'grunt', 'playerFocused')).toEqual({ x: 0.12, y: 0.78 })
  })

  it('falls back to the center-most spot when the active tier is not in the team', () => {
    const spot = resolveFocusSpot(BATTLEGROUNDS.battleground1, DEFAULT_TEAM, 'wizard', 'playerFocused')
    expect(spot).toEqual(BATTLEGROUNDS.battleground1.playerTeam[1])
  })

  it('has no focus in wide mode', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, DEFAULT_TEAM, 'grunt', 'wide')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/battle/BattleStage.test.tsx`
Expected: FAIL (module `./BattleStage` cannot be resolved).

- [ ] **Step 3: Write the BattleStage component**

Create `client/src/components/battle/BattleStage.tsx`:

```tsx
'use client'

import type { Battleground, FighterSpot } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { SPRITE_MAP } from '@/lib/sprites'
import ParallaxScene from './ParallaxScene'
import BattleCamera from './BattleCamera'
import FighterSprite from './FighterSprite'

export type CameraMode = 'wide' | 'playerFocused'

interface BattleStageProps {
  battleground: Battleground
  running: boolean
  playerTeam: Team
  opponentTeam: Team
  activePlayerTier: Tier | null
  activeOpponentTier: Tier | null
  cameraMode: CameraMode
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

export default function BattleStage({
  battleground,
  running,
  playerTeam,
  opponentTeam,
  activePlayerTier,
  activeOpponentTier,
  cameraMode,
}: BattleStageProps) {
  const focus = resolveFocusSpot(battleground, playerTeam, activePlayerTier, cameraMode)

  const renderTeam = (team: Team, spots: FighterSpot[], activeTier: Tier | null, mirror: boolean) =>
    team.map((tier, index) => {
      const spot = spots[index]
      return (
        <div
          key={tier}
          className="absolute"
          style={{
            left: `${spot.x * 100}%`,
            top: `${spot.y * 100}%`,
            transform: `translate(-50%, -100%) ${mirror ? 'scaleX(-1)' : ''}`,
            zIndex: 10,
          }}
        >
          <FighterSprite src={SPRITE_MAP[tier]} alt={tier} active={tier === activeTier} />
        </div>
      )
    })

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <ParallaxScene battleground={battleground} running={running} />
      <BattleCamera focus={focus}>
        <div className="absolute inset-0">
          {renderTeam(playerTeam, battleground.playerTeam, activePlayerTier, false)}
          {renderTeam(opponentTeam, battleground.opponentTeam, activeOpponentTier, true)}
        </div>
      </BattleCamera>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/battle/BattleStage.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/battle/BattleStage.tsx client/src/components/battle/BattleStage.test.tsx
git commit -m "feat: add battle stage composing parallax, camera, and teams"
```

---

### Task 7: TypingArea onStartTyping callback

**Files:**
- Modify: `client/src/components/TypingArea.tsx`
- Test: `client/src/components/TypingArea.test.tsx`

**Interfaces:**
- Consumes: none new.
- Produces: `interface TypingAreaProps` gains `onStartTyping?: () => void`.

- [ ] **Step 1: Write the failing test**

Append to `client/src/components/TypingArea.test.tsx` inside the `describe` block:

```tsx
  it('calls onStartTyping on the first keystroke', () => {
    const onStartTyping = vi.fn()
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} onStartTyping={onStartTyping} />)
    fireEvent.keyDown(document, { key: 'H' })
    fireEvent.keyDown(document, { key: 'i' })
    expect(onStartTyping).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/TypingArea.test.tsx`
Expected: FAIL (expected `onStartTyping` to have been called 1 time, but received 0).

- [ ] **Step 3: Wire the callback**

In `client/src/components/TypingArea.tsx`:

1. Add `onStartTyping?: () => void` to `TypingAreaProps` (line 5-10).
2. Add `const startedRef = useRef(false)` next to the other refs (near line 39).
3. Reset it in the phrase-change effect (line 60-67). After `totalKeystrokesRef.current = 0`, add `startedRef.current = false`.
4. Change the destructure on line 31 from `{ phrase, onComplete, disabled, damageFlash = 0 }` to `{ phrase, onComplete, onStartTyping, disabled, damageFlash = 0 }`.
5. In `handleKeyDown`, after the guard `if (pos >= phrase.length) return` (line 108) and before `e.preventDefault()`, insert:

```ts
if (!startedRef.current) {
  startedRef.current = true
  onStartTyping?.()
}
```

6. Add `onStartTyping` to the `handleKeyDown` dependency array (line 128) so it becomes `[phrase, disabled, onComplete, onStartTyping]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/TypingArea.test.tsx`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TypingArea.tsx client/src/components/TypingArea.test.tsx
git commit -m "feat: fire onStartTyping on the first keystroke"
```

---

### Task 8: Server assigns battleground in game_setup

**Files:**
- Create: `server/internal/game/battleground.go`
- Test: `server/internal/game/battleground_test.go`
- Modify: `server/internal/ws/protocol.go` (add `Battleground` field to `ServerMessage`)
- Modify: `server/internal/ws/handler.go:144-149` and `:245-250` (both `game_setup` broadcasts)
- Modify: `server/internal/ws/protocol_test.go` (add game_setup marshal test)
- Modify: `server/internal/ws/handler_test.go` (add start_game test)

**Interfaces:**
- Produces: `func GetRandomBattleground() string` (returns one of `["battleground1", ...]`), `ServerMessage.Battleground string` with `json:"battleground,omitempty"`.

- [ ] **Step 1: Write the failing game test**

Create `server/internal/game/battleground_test.go`:

```go
package game

import "testing"

func TestGetRandomBattleground_ReturnsKnown(t *testing.T) {
	for i := 0; i < 50; i++ {
		bg := GetRandomBattleground()
		found := false
		for _, known := range battlegrounds {
			if bg == known {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("unexpected battleground %q", bg)
		}
	}
}

func TestBattlegrounds_NonEmpty(t *testing.T) {
	if len(battlegrounds) == 0 {
		t.Fatal("battlegrounds list must not be empty")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test ./internal/game/ -run TestGetRandomBattleground`
Expected: FAIL (compile error: undefined `GetRandomBattleground` / `battlegrounds`).

- [ ] **Step 3: Write the battleground list**

Create `server/internal/game/battleground.go`:

```go
package game

import "math/rand"

var battlegrounds = []string{"battleground1"}

func GetRandomBattleground() string {
	return battlegrounds[rand.Intn(len(battlegrounds))]
}
```

- [ ] **Step 4: Run game test to verify it passes**

Run: `cd server && go test ./internal/game/ -run TestGetRandomBattleground`
Expected: PASS.

- [ ] **Step 5: Add the protocol field**

In `server/internal/ws/protocol.go`, in the `ServerMessage` struct (lines 18-37), after `PhrasePools`, add:

```go
	Battleground  string              `json:"battleground,omitempty"`
```

- [ ] **Step 6: Add the marshal test**

Append to `server/internal/ws/protocol_test.go`:

```go
func TestServerMessageMarshal_GameSetup(t *testing.T) {
	msg := ServerMessage{
		Type:         "game_setup",
		PhrasePools:  map[string][]string{"grunt": {"hi"}},
		Battleground: "battleground1",
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if result["type"] != "game_setup" {
		t.Errorf("got type %v, want 'game_setup'", result["type"])
	}
	if result["battleground"] != "battleground1" {
		t.Errorf("got battleground %v, want 'battleground1'", result["battleground"])
	}
}
```

- [ ] **Step 7: Run protocol test to verify it fails**

Run: `cd server && go test ./internal/ws/ -run TestServerMessageMarshal_GameSetup`
Expected: FAIL (`battleground` field is empty in JSON).

- [ ] **Step 8: Set the battleground in both game_setup broadcasts**

In `server/internal/ws/handler.go`, change both occurrences of:

```go
		setupMsg := ServerMessage{
			Type:        "game_setup",
			PhrasePools: game.GetPhrasePools(),
		}
```

to:

```go
		setupMsg := ServerMessage{
			Type:         "game_setup",
			PhrasePools:  game.GetPhrasePools(),
			Battleground: game.GetRandomBattleground(),
		}
```

(There are two identical blocks: lines ~144-149 and ~245-250.)

- [ ] **Step 9: Run protocol test to verify it passes**

Run: `cd server && go test ./internal/ws/ -run TestServerMessageMarshal_GameSetup`
Expected: PASS.

- [ ] **Step 10: Add the handler test**

Append to `server/internal/ws/handler_test.go`:

```go
func TestHandleStartGame_SendsGameSetupWithBattleground(t *testing.T) {
	connHost := &TestConnection{}
	connJoiner := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")
	handler := NewHandler(hub, rm)

	// Both players must join so their connections are registered with the hub;
	// broadcasts (game_start, game_setup) only reach registered clients.
	hostJoin, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Host Player"})
	handler.HandleMessage(connHost, room.ID, "host1", hostJoin)
	time.Sleep(10 * time.Millisecond)

	joinerJoin, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Joiner"})
	handler.HandleMessage(connJoiner, room.ID, "player2", joinerJoin)
	time.Sleep(10 * time.Millisecond)

	startData, _ := json.Marshal(ClientMessage{Type: "start_game"})
	handler.HandleMessage(connHost, room.ID, "host1", startData)
	time.Sleep(20 * time.Millisecond)

	found := false
	for _, raw := range connHost.messages {
		var resp ServerMessage
		if err := json.Unmarshal(raw, &resp); err != nil {
			continue
		}
		if resp.Type == "game_setup" && resp.Battleground != "" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected a game_setup message carrying a battleground id")
	}
}
```

- [ ] **Step 11: Run the handler test to verify it passes**

Run: `cd server && go test ./internal/ws/ -run TestHandleStartGame_SendsGameSetupWithBattleground`
Expected: PASS.

- [ ] **Step 12: Run the full server suite**

Run: `cd server && go test ./...`
Expected: PASS (all tests, existing and new).

- [ ] **Step 13: Commit**

```bash
git add server/internal/game/battleground.go server/internal/game/battleground_test.go server/internal/ws/protocol.go server/internal/ws/protocol_test.go server/internal/ws/handler.go server/internal/ws/handler_test.go
git commit -m "feat: assign a random battleground in game_setup"
```

---

### Task 9: Client protocol + page stores battleground id

**Files:**
- Modify: `client/src/lib/ws.ts:38` (game_setup type)
- Test: `client/src/lib/ws.test.ts` (add battleground assertion)
- Modify: `client/src/app/room/[id]/page.tsx` (store battleground id from game_setup)

**Interfaces:**
- Consumes: server `game_setup` now sends `battleground?: string`.
- Produces: `battlegroundId` state in `page.tsx`.

- [ ] **Step 1: Write the failing test**

In `client/src/lib/ws.test.ts`, replace the existing `'should have game_setup type'` test (lines 31-37) with:

```ts
  it('should have game_setup type with battleground', () => {
    const msg: ServerMessage = {
      type: 'game_setup',
      phrase_pools: { grunt: ['phrase1'], archer: ['phrase2'] },
      battleground: 'battleground1'
    }
    expect(msg.type).toBe('game_setup')
    expect(msg.battleground).toBe('battleground1')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/ws.test.ts`
Expected: FAIL (TypeScript/object literal may only specify known properties — `battleground` is not a known property of the `game_setup` union member).

- [ ] **Step 3: Update the protocol type**

In `client/src/lib/ws.ts`, change line 38 from:

```ts
  | { type: 'game_setup'; phrase_pools: Record<string, string[]> }
```

to:

```ts
  | { type: 'game_setup'; phrase_pools: Record<string, string[]>; battleground?: string }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/ws.test.ts`
Expected: PASS.

- [ ] **Step 5: Store the battleground id in page.tsx**

In `client/src/app/room/[id]/page.tsx`:

1. Add state after line 75 (`const [opponentAttack, setOpponentAttack] = useState<string>('')`):

```tsx
  const [battlegroundId, setBattlegroundId] = useState<string | null>(null)
```

2. Update the `case 'game_setup':` handler (lines 210-214):

```tsx
      case 'game_setup':
        if (message.phrase_pools) {
          phrasePoolsRef.current = message.phrase_pools
        }
        setBattlegroundId(message.battleground || null)
        break
```

- [ ] **Step 6: Verify the page still renders**

Run: `cd client && npx vitest run src/app/room/\[id\]/page.test.tsx`
Expected: PASS (lobby smoke test).

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/ws.ts client/src/lib/ws.test.ts client/src/app/room/\[id\]/page.tsx
git commit -m "feat: receive battleground id in game_setup"
```

---

### Task 10: Full-screen battle scene in page.tsx + camera triggers + HUD re-skin

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: `BattleStage`, `CameraMode`, `Team`, `getTeam`, `DEFAULT_TEAM`, `getBattleground`, `Tier` (all defined in earlier tasks).
- Produces: the `countdown`/`playing` state renders `BattleStage` full-screen with translucent HUD overlays; camera zooms on attack select and returns to `wide` on first keystroke.

- [ ] **Step 1: Add imports**

In `client/src/app/room/[id]/page.tsx`, change the import on line 19 from:

```tsx
import { getRandomPhrase } from '@/lib/words'
```

to:

```tsx
import { getRandomPhrase, type Tier } from '@/lib/words'
import BattleStage, { type CameraMode } from '@/components/battle/BattleStage'
import { getTeam, DEFAULT_TEAM, type Team } from '@/lib/team'
import { getBattleground } from '@/lib/battlegrounds'
```

- [ ] **Step 2: Add state**

After the `opponentAttack` state (line 75), add:

```tsx
  const [cameraMode, setCameraMode] = useState<CameraMode>('wide')
  const [playerTeam] = useState<Team>(() => getTeam())
```

- [ ] **Step 3: Add camera triggers**

In `handleSelectAttack` (line 434-443), after `setCurrentDamage(def)` add `setCameraMode('playerFocused')`.

In `handleAttackComplete` (line 445-468), after `setCurrentAttack('')` add `setCameraMode('wide')`.

In `handleCountdownComplete` (line 489-495), after `totalKeystrokesRef.current = 0` add `setCameraMode('wide')`.

- [ ] **Step 4: Render the full-screen scene**

In the returned JSX:

1. Change the `<main>` className (line 519) from `"min-h-screen bg-gray-900 text-white p-8"` to `"relative min-h-screen bg-gray-900 text-white p-8"`.
2. Immediately after the closing `</style>` tag (line 536) and before `<div className="max-w-4xl mx-auto">` (line 537), insert:

```tsx
        {(gameState === 'countdown' || gameState === 'playing') && (
          <div className={`fixed inset-0 z-0 ${gameState === 'countdown' ? 'blur-sm' : ''}`} aria-hidden>
            <BattleStage
              battleground={getBattleground(battlegroundId ?? undefined)}
              running={gameState === 'playing'}
              playerTeam={playerTeam}
              opponentTeam={DEFAULT_TEAM}
              activePlayerTier={(currentAttack as Tier) || null}
              activeOpponentTier={(opponentAttack as Tier) || null}
              cameraMode={cameraMode}
            />
          </div>
        )}
```

3. Change `<div className="max-w-4xl mx-auto">` (line 537) to `<div className="relative z-10 max-w-4xl mx-auto">`.

- [ ] **Step 5: Re-skin the HUD overlays**

1. In the battle panel container (line 597), replace:

```tsx
              <div className={`relative bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700 py-8 px-6 shadow-lg ${gameState === 'countdown' ? 'blur-sm pointer-events-none' : ''}`}>
```

with:

```tsx
              <div className={`relative rounded-xl border border-gray-700/40 bg-black/40 backdrop-blur-sm py-8 px-6 shadow-lg ${gameState === 'countdown' ? 'pointer-events-none' : ''}`}>
```

2. Wrap the `TypingArea` (lines 698-704) in a frosted container:

```tsx
                  {currentPhrase && (
                    <div className="rounded-xl border border-gray-700/40 bg-black/50 backdrop-blur-md p-4">
                      <TypingArea
                        phrase={currentPhrase}
                        onComplete={handleAttackComplete}
                        damageFlash={playerDamageFlash}
                        onStartTyping={() => setCameraMode('wide')}
                      />
                    </div>
                  )}
```

3. Wrap the `AttackSelector` (lines 731-738) in a frosted container:

```tsx
        {(gameState === 'countdown' || gameState === 'playing') && (
          <div className="mt-6 flex justify-center">
            <div className="rounded-xl border border-gray-700/40 bg-black/40 backdrop-blur-sm p-3">
              <AttackSelector
                onSelect={handleSelectAttack}
                currentAttack={currentAttack}
                disabled={gameState !== 'playing'}
              />
            </div>
          </div>
        )}
```

4. Make the header readable over the scene. Change line 538 from:

```tsx
        <div className="flex justify-between items-center mb-8">
```

to:

```tsx
        <div className={`flex justify-between items-center mb-8 ${gameState === 'countdown' || gameState === 'playing' ? 'rounded-xl bg-black/40 backdrop-blur-sm px-4 py-3' : ''}`}>
```

- [ ] **Step 6: Run the page + component tests**

Run: `cd client && npx vitest run src/app/room/\[id\]/page.test.tsx src/components/battle src/components/TypingArea.test.tsx src/lib`
Expected: PASS (all battle, typing, lib, and page tests).

- [ ] **Step 7: Lint**

Run: `cd client && npm run lint`
Expected: PASS (no errors).

- [ ] **Step 8: Commit**

```bash
git add client/src/app/room/\[id\]/page.tsx
git commit -m "feat: render full-screen battle scene with translucent HUD and camera triggers"
```

---

### Task 11: Place assets + full verification

**Files:**
- User action: copy the CraftPix parallax PNGs into `client/public/battlegrounds/battleground1/` with the slug filenames below.

- [ ] **Step 1: Copy the downloaded assets**

From the CraftPix download, copy these files into `client/public/battlegrounds/battleground1/`, renaming to match the manifest:

| Source file (approx.) | Destination |
|---|---|
| `Sky.png` | `sky.png` |
| `Ruins_bg.png` | `ruins-bg.png` |
| `Ruins2.png` | `ruins2.png` |
| `Ruins.png` | `ruins.png` |
| `Hill&trees.png` | `hill-trees.png` |
| `Statue.png` | `statue.png` |
| `Stones&grass.png` | `stones-grass.png` |

If the actual filenames differ, keep the **destination** names exact — the manifest references those paths. (If you prefer WebP to reduce weight, convert each to `.webp` and update the manifest `image` paths instead.)

- [ ] **Step 2: Full client verification**

Run: `cd client && npm run lint && npm test && npm run build`
Expected: lint clean, all tests pass, build succeeds.

- [ ] **Step 3: Full server verification**

Run: `cd server && go test ./...`
Expected: all tests pass.

- [ ] **Step 4: Manual smoke test**

Run: `cd client && npm run dev` and `cd server && make dev`. Create/join a room and start a match. Verify:
- The battleground fills the viewport with layered parallax drifting (foreground faster than background).
- Both 4-member teams stand on the ground layer, opponent mirrored.
- Pressing a number key (1-7) zooms the camera toward the player's fighters; the first keystroke in the typing panel returns it to the wide shot.
- HP bars, timer, typing panel, and attack selector appear as translucent overlays over the scene.

- [ ] **Step 5: Commit any asset/optimization changes**

If you converted to WebP (updating the manifest), commit:

```bash
git add client/public/battlegrounds client/src/lib/battlegrounds.ts
git commit -m "build: add battleground1 parallax assets"
```

---

## Self-Review Notes

- **Spec coverage:** manifest (Task 1), team persistence (Task 2), sprites/fighters (Task 3), parallax engine (Task 4), camera (Task 5), stage composition (Task 6), first-keystroke zoom-out trigger (Task 7), server assignment (Task 8), client protocol + battleground state (Task 9), full-screen scene + HUD + triggers (Task 10), assets + verification (Task 11). All spec sections 3-9 map to tasks.
- **Type consistency:** `Tier` exported once in `words.ts`; `Team`/`DEFAULT_TEAM` in `team.ts`; `Battleground`/`FighterSpot`/`getBattleground` in `battlegrounds.ts`; `CameraMode` in `BattleStage.tsx`; `advanceParallaxOffset`/`layerTranslate` in `parallax.ts`; `SPRITE_MAP` in `sprites.ts` — each consumed with the same names they are produced with.
- **Camera fallback:** `resolveFocusSpot` uses `playerTeam[1]` (the center-most of the 4 spots), matching the spec's "2nd of the 4-fighter row".
