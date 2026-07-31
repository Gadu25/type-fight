# Battleground Background (v0.4 Visual Upgrade)

Version: 0.4 (Visual Upgrade)
Project: Type-Fight
Date: 2026-07-31

---

# 1. Goal

Start the v0.4 visual upgrade by adding an immersive, full-screen battle scene:

- A **parallax battleground background** rendered behind the battle.
- **Full 4-member team fighters** standing on the ground layer (placeholder sprites for now).
- A **camera system** that zooms toward the player's selected fighter when choosing an attack and returns to the wide shot when typing begins.
- A **dynamic battleground system** so new backgrounds (Battleground 2, 3, ...) can be added via manifest entries — no component code changes.

The design is **dynamic and data-driven**: battlegrounds are declared in a manifest, teams are persisted in localStorage, and fighter positions are manifest values that can be tuned without touching code.

---

# 2. Current State

- The arena is a contained gradient card (`bg-gradient-to-b from-gray-800/50 to-gray-900/50`) on a solid `bg-gray-900` page. No image background in the battle.
- Character art is 14 small SVGs (`public/sprites/{tier}_{idle|attack}.svg`, 52×62) used only in `AttackSelector`.
- No team system exists yet (server engine has no team concept; gameplay uses all 7 tiers via `AttackSelector`, keys 1–7).
- No team selection UI. Team persistence does not exist.
- The home page already demonstrates the absolute-positioned full-viewport background image + dark overlay pattern.
- Tailwind v4 (CSS-based config), no animation/canvas libraries. All effects are hand-rolled CSS keyframes / inline transitions.

---

# 3. Architecture

**New client modules** (all under `client/src/`):

```
lib/battlegrounds.ts        # battleground manifest + types + look-up/fallback helpers
lib/team.ts                 # team persistence (localStorage) + default team
components/battle/
  ParallaxScene.tsx         # renders parallax layers, runs the rAF pan loop
  BattleCamera.tsx          # camera wrapper div (scale + transform-origin, CSS-transition driven)
  FighterSprite.tsx         # single fighter image w/ active highlight + idle bob
  BattleStage.tsx           # composes scene + camera + both teams
```

**Page wiring** (`client/src/app/room/[id]/page.tsx`):

- Game logic stays in `page.tsx`.
- During `countdown`/`playing`, the current gradient arena panel is replaced by a full-viewport `BattleStage`.
- The HUD elements (HP bars, `BattleTimer`, `TypingArea`, `AttackSelector`, attack badges, floating damage) stay in `page.tsx` but are re-skinned as translucent overlays positioned over the scene.
- In `lobby`/`finished` states the page keeps its current dark look — the scene only renders during the battle.

```
┌──────────────────────────────────────────────┐
│  header (frosted bar: logo, room code)       │
├──────────────────────────────────────────────┤
│  ◄ HP bar ────────┐  ⏱  ┌──────── HP bar ►   │
│                    │      │                   │
│      (player team 4 fighters)  (opponent 4)   │  ← on ground layer
│  ════════ parallax battleground ══════════   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  frosted typing panel (phrase)          │  │
│  └────────────────────────────────────────┘  │
│  AttackSelector (frosted, 7 character buttons)│
└──────────────────────────────────────────────┘
```

`BattleStage` receives battle data (teams, active tiers) as props; `page.tsx` overlays the HUD.

---

# 4. Dynamic Battleground Manifest

`client/src/lib/battlegrounds.ts` is the single source of truth. A battleground is a typed config; adding a new battleground means dropping PNGs into a folder and adding one manifest entry.

```ts
type ParallaxLayer = {
  id: string
  image: string      // "/battlegrounds/battleground1/sky.png"
  speed: number      // parallax factor 0–1 (0 = static far, 1 = fastest near)
  anchor: 'top' | 'center' | 'bottom'   // vertical crop behavior (sky→top, ground→bottom)
}

type FighterSpot = {
  x: number          // horizontal position as fraction of stage width (0–1)
  y: number          // vertical position as fraction of stage height (feet on ground)
}

type Battleground = {
  id: string                 // 'battleground1'
  name: string               // 'Ancient Ruins'
  layers: ParallaxLayer[]    // back → front order
  playerTeam: FighterSpot[]  // exactly 4, for the player's fighters
  opponentTeam: FighterSpot[] // exactly 4, for the opponent's fighters
}

export const BATTLEGROUNDS: Record<string, Battleground> = { ... }
```

**Battleground 1 — "Ancient Ruins"** (back → front):

| Layer | File (slug) | Speed | Anchor |
|-------|-------------|-------|--------|
| sky | `sky.png` | 0.0 | top |
| ruins background | `ruins-bg.png` | 0.08 | bottom |
| ruins 2 | `ruins2.png` | 0.18 | bottom |
| ruins | `ruins.png` | 0.32 | bottom |
| hill & trees | `hill-trees.png` | 0.5 | bottom |
| statue | `statue.png` | 0.72 | bottom |
| stones & grass | `stones-grass.png` | 1.0 | bottom |

Fighter spots sit just above the ground on the "stones & grass" layer, e.g. player at `x ≈ 0.12–0.36`, opponent at `x ≈ 0.64–0.88`, `y ≈ 0.78` (all tunable).

Speeds are the far-to-near curve (sky static, foreground fastest) and can be tuned once the art is visible. Fighter positions are plain numbers in the manifest — adjustable at any time without code changes.

**Asset handling:**

- PNGs live at `client/public/battlegrounds/battleground1/`.
- Source filenames with spaces/`&` are renamed to safe slugs (`hill&trees.png` → `hill-trees.png`) and mapped in the manifest.
- Layers use plain `<img>` (not `next/image`) since they are animated via CSS transforms. `draggable={false}`.
- Optional asset task: convert the source PNGs to WebP to cut weight (CraftPix 1920×1080 PNGs are typically 1–3 MB each; 7 layers × 2 tiles is the main perf risk).

---

# 5. Parallax Engine (`ParallaxScene.tsx`)

**Tiling for a seamless loop.** Each layer is a "track" — a div `absolute inset-0` sized `width: 200%` containing **two identical copies** of the image side by side, each half the track width (so each copy fills the viewport), with `object-cover` and the layer's `anchor` vertical alignment:

```
┌──────────────viewport──────────────┐
│  copy 1 (object-cover) │ copy 2    │   ← the track (200vw), translated
└────────────────────────────────────┘
```

**The loop.** One `requestAnimationFrame` loop keeps a shared offset `t` growing over time. Each track translates by `translate3d(-(t × speed × 100%), 0, 0)`. The full cycle is reached when `t` equals one viewport width — at that point copy 2 is exactly where copy 1 was, so `t` resets to 0 with no visible jump. `will-change: transform` keeps it GPU-composited.

**Controls:**

- The loop runs only while `gameState` is `countdown`/`playing` (paused otherwise).
- rAF auto-pauses in background tabs for free.

**Crop behavior:** with `object-cover`, landscape art crops vertically; `anchor` picks which part stays visible (`top` keeps the sky, `bottom` keeps the ground where fighters stand). On different aspect ratios the art re-crops automatically; fighter spots are relative so they stay on the ground.

---

# 6. Camera System (`BattleCamera.tsx`)

The camera is a wrapper div around the whole scene (layers + fighters). It has exactly two transforms:

| State | `transform` | `transform-origin` |
|-------|-------------|---------------------|
| `wide` | `scale(1)` | `50% 50%` (center) |
| `playerFocused` | `scale(1.12)` | at the active fighter's spot (`(x×100)% (y×100)%`) |

Both changes animate via CSS `transition: transform 500ms cubic-bezier(.22,.9,.35,1)` — no JS easing.

**Trigger mapping** (wired in `page.tsx`):

- **Zoom in:** `handleSelectAttack` (number key or click) → `playerFocused`, origin at the selected fighter's spot in the player team. If the selected tier is not in the displayed team (possible until team selection exists), fall back to the team's center spot.
- **Zoom out:** the moment the user actually starts typing → back to `wide`. `TypingArea` gains a small `onStartTyping` callback that fires on the first keystroke (additive; does not change existing behavior).

**Coexistence with parallax:** the camera wraps the parallax tracks, so layer pan transforms are nested inside the camera transform — they compose naturally. The rAF loop keeps running; zooming crops the edges like a real camera move.

**Out of scope (YAGNI):** zoom to the opponent side on their attack selection, mid-typing camera drift, pause-when-typing. Easy to add later.

---

# 7. Team Persistence + Stage Fighters

Team selection UI does not exist yet. Build the persistence layer now so the eventual picker writes to the same key.

**New module `client/src/lib/team.ts`:**

- `type Team = ('grunt'|'archer'|'paladin'|'wizard'|'cleric'|'priest'|'saint')[]` (exactly 4)
- `STORAGE_KEY = 'typefight_team'` — follows the existing `typefight_account` pattern
- `getTeam()` / `saveTeam()` — read/write with JSON-safe fallbacks
- `DEFAULT_TEAM = ['grunt','archer','paladin','cleric']` (the spec's "Balanced" example) used when nothing is stored
- Exactly-4 validation on load (corrupt/invalid data → `DEFAULT_TEAM`)

**`FighterSprite.tsx`** — renders one fighter:

- Placeholder art: existing `/sprites/{tier}_idle.svg` scaled up ~3×.
- Subtle idle bob animation (reusing the project's CSS keyframe pattern).
- `active` prop → highlight ring + glow under the selected fighter.
- A `SPRITE_MAP: Record<tier, path>` const keeps art swappable later — real sprites require touching only that map.

**Stage composition (`BattleStage.tsx`):**

- Player side: the persisted `getTeam()` team.
- Opponent side: default placeholder team (the server does not send teams yet — noted as a future `game_setup` field when v0.3 team battle lands).
- Active highlight: player side highlights the fighter whose tier === `currentAttack`; opponent side highlights tier === `opponentAttack`. If the selected tier is not in the displayed team, no fighter highlights (graceful fallback until real teams exist).
- Camera zoom origin uses the highlighted fighter's spot when one is active.

The stage is fully data-driven: when real teams + server-sent teams arrive, they are passed in as props without structural changes.

---

# 8. Server Change (battleground assignment)

Small, additive change so both players see the same scene:

- **`server/internal/game/`:** a `Battlegrounds = []string{"battleground1"}` list (grows as more are added).
- **At game start:** the room picks one at random and includes `battleground: "<id>"` in the existing `game_setup` message, already broadcast to both players. Adding a field to the existing `GameSetupPayload` struct; old clients ignore unknown fields.
- **Client:** `BattleStage` receives the id from `game_setup` and looks it up in `BATTLEGROUNDS`; unknown id → fall back to `battleground1`.

No HTTP routes, no asset serving — assets are static client files. The server only sends an id.

---

# 9. Testing

Following the project's existing Vitest + Go test patterns:

- **`battlegrounds.ts`:** manifest integrity (all layers reference existing paths, speeds 0–1, exactly 4 fighter spots per team) and the look-up/fallback helper.
- **`team.ts`:** get/save round-trip, corrupt JSON → `DEFAULT_TEAM`, exactly-4 validator.
- **`ParallaxScene`:** component test that all layers render (image count) and that a no-motion/static prop renders fine; the rAF loop offset math is tested via a small pure helper rather than the animation itself.
- **Server:** `game_setup` payload now carries `battleground` — update existing handler/protocol tests to assert it is present and in the allowed list.
- **Regression:** existing arena page tests still pass (HUD elements still render during `countdown`/`playing`).

---

# 10. Out of Scope / Future

- Team selection UI (v0.3 remainder) — this spec only adds the persistence layer it will write to.
- Real character sprites and attack animations — `SPRITE_MAP` is the swap point.
- Opponent team in the protocol — future `game_setup` field.
- Additional battlegrounds — manifest entries + server list additions.
- Sound effects, hit effects, screen effects (rest of v0.4).

# End of Specification
