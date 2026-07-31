# Team Selection, Loadout Enforcement & Static Battleground

Version: 0.5 (Team Selection)
Project: Type-Fight
Date: 2026-07-31

---

# 1. Goal

Replace the fixed 7-tier battle setup with a player-chosen 4-character team:

- A **team picker UI** (new component) lets the player pick exactly 4 of the 7 characters. It appears on the **home page** and in the **room lobby**.
- The **team is the loadout**: only the 4 chosen characters are usable/selectable in battle (client UI and server enforcement).
- The **battlefield shows both players' real teams** (the opponent's fighters match what they actually picked — no more hardcoded default team).
- **Ready/Start gating:** neither player can ready up or start until they have picked exactly 4.
- The **battleground becomes fully static**: remove the idle pan loop; the camera zoom onto the selected fighter when choosing an attack is the *only* motion.

Decisions locked in during brainstorming:

- Selection is a **loadout** — only the 4 picked tiers are selectable in battle.
- **No default team** — a new player starts empty and must pick explicitly (no `DEFAULT_TEAM` auto-fill).
- **Any 4 distinct** tiers is legal (4 healers is fine).
- The 4/4 requirement gates **only** Ready/Start; creating/joining a room is not gated.
- Approach B: team is sent with the `ready` message, stored server-side, enforced in the attack handlers, and broadcast back so the opponent's fighters are accurate.

---

# 2. Current State

- `client/src/lib/team.ts` persists `typefight_team` in localStorage but auto-fills `DEFAULT_TEAM = ['grunt','archer','paladin','cleric']` when nothing is stored. `saveTeam()` requires exactly 4 tiers.
- `AttackSelector.tsx` renders all 7 tiers (hotkeys 1–7); the server accepts any valid tier for `select_attack` / `switch_attack` / `attack_complete`.
- `BattleStage` renders `playerTeam` from `getTeam()` and a hardcoded `opponentTeam={DEFAULT_TEAM}`.
- Lobby ready flow: non-host presses **Ready** (sends `{type:'ready'}`), host presses **Start** (sends `{type:'start_game'}`). Neither is gated on any team concept.
- `PlayerState` has no team field; `PlayerInfo` has only `id`/`name`.
- `ParallaxScene` runs a `requestAnimationFrame` pan loop (via `parallax.ts` helpers) with two-copy tiling per layer; `running` prop controls the loop.

---

# 3. Architecture Overview

Two related change surfaces:

```
CLIENT                                  SERVER
──────                                  ──────
TeamPicker (home + lobby)     ──ready{team}──►  SetPlayerReady(roomID, pid, team)
  │                                            PlayerState.Team
  │  auto-saves to                              validates exactly 4 distinct valid tiers
  │  localStorage                               rejects ready without valid team
  │
  ▼
PlayerList Ready/Start gated on 4/4
AttackSelector filtered to team ──select_attack──► SelectAttack  — tier must be in team
BattleStage: both teams from                    SwitchAttack  — tier must be in team
server player data                              CompleteAttack — tier must be in team
                                                (StartGame also validates all teams)

All PlayerInfo payloads gain `team` → broadcast back to clients (player_list, game_start,
player_joined, player_left).
```

**Static scene:** `ParallaxScene` drops the rAF loop, the `running` prop, and the 2-copy tiling. Each layer renders once (`object-cover` + anchor). `BattleCamera` (zoom on attack select) is unchanged and becomes the only motion.

---

# 4. Client: Team Picker

## 4.1 `client/src/lib/team.ts` changes

`Team` type stays `Tier[]` (subset of the 7 tiers, length 0–4 allowed as a *draft*, length must be exactly 4 to play).

- Remove `DEFAULT_TEAM`.
- `getTeam(): Team` — return the saved team or `[]` when nothing is stored / data is corrupt / SSR (no `window`). Never auto-fills.
- `saveTeam(team: Team): void` — now accepts any *draft*: length 0–4, all tiers valid, no duplicates. Throws otherwise. This lets the picker persist partial selections.
- `isValidTeam(value): value is Team` — unchanged semantics (exactly 4, distinct, valid). Used for ready gating and server-side parity.
- Add internal `isValidTeamDraft(value)` (length 0–4, distinct, valid) used by `getTeam`/`saveTeam`.
- Keep `STORAGE_KEY = 'typefight_team'` and `TEAM_SIZE = 4`.

## 4.2 New `client/src/components/TeamPicker.tsx`

Controlled, presentational component. Props:

```ts
interface TeamPickerProps {
  team: Team
  onChange: (team: Team) => void
  disabled?: boolean      // locked after ready / outside lobby
}
```

- Renders all 7 character cards (sprite `/sprites/{tier}_idle.svg`, name, damage/heal value from the same tier metadata `AttackSelector` uses).
- Click toggles selection: adds if unselected and `team.length < 4`; removes if selected.
- Selected cards show an order badge (1–4) — order is the order they were picked, which maps to `playerTeam` spots in `BattleStage`.
- Helper text: `"Pick exactly 4 characters"` + counter `n/4`; turns green at 4/4.
- `disabled` prevents clicks (opacity, no pointer events).

## 4.3 Home page (`client/src/app/page.tsx`)

- Add `const [team, setTeam] = useState<Team>(() => getTeam())`.
- Render `<TeamPicker team={team} onChange={handleTeamChange} />` inside the card, above the buttons.
- `handleTeamChange(t)`: `setTeam(t); saveTeam(t)`. `saveTeam` accepts drafts, so partial picks persist safely.
- Create/Join buttons are **not** gated.

## 4.4 Room lobby (`client/src/app/room/[id]/page.tsx`)

- Add `const [team, setTeam] = useState<Team>(() => getTeam())`.
- Render `<TeamPicker ... disabled={gameState !== 'lobby' || isReady} />` in the lobby panel (next to `PlayerList`). Hosts stay editable until they press Start; non-hosts lock once they Ready.
- `handleTeamChange(t)`: `setTeam(t); saveTeam(t)`.
- `handleReady` becomes team-aware:

```ts
const handleReady = useCallback(() => {
  if (wsRef.current && team.length === 4) {
    sendMessage(wsRef.current, { type: 'ready', team })
    setIsReady(true)
  }
}, [team])
```

## 4.5 `PlayerList` gating

- New prop `teamComplete: boolean`.
- `canReady = !isHost && players.length === 2 && gameStatus === 'lobby' && !isRoomFull && teamComplete`
- `canStart = isHost && players.length === 2 && gameStatus === 'lobby' && !isRoomFull && opponentReady && teamComplete`
- Non-host button label when `!teamComplete`: `"Pick a team first"` (still disabled). Host keeps `Start Game` (disabled until complete).

---

# 5. Server: Team Sync & Enforcement

## 5.1 `server/internal/game/room.go`

- `PlayerState` gains `Team []string`.
- New helper `func IsValidTeam(team []string) bool` in `engine.go` (or room.go): length exactly 4, no duplicates, every tier has `GetAttackDef(tier).MinWords > 0`.
- `SetPlayerReady(roomID, playerID, team []string)` — signature change: validate `team` via `IsValidTeam`; on failure return error `"invalid team"` and do **not** mark ready. On success store `player.Team = team`, set `Ready = true`, return `allReady` as today.
- `SelectAttack(playerID, tier)` — after locating the player, reject with `"attack tier not in your team"` unless `tier ∈ player.Team`.
- `SwitchAttack(playerID, newTier)` — same team check.
- `CompleteAttack(playerID, tier, ...)` — after the existing `CurrentAttack == tier` check, reject if `tier ∉ player.Team` (defense in depth).
- `StartGame(roomID, playerID)` — add validation: every player in the room must have a valid team, else error `"all players must pick a team"`. (Covers the host, whose Start isn't otherwise team-checked.)
- `ResetRoom` — do **not** clear `Team` (loadout persists across rematches).
- `RemovePlayer` result and `Room.GetRoomInfo`/`GetPlayerName` player info — include `Team` in any `PlayerInfo` construction.

## 5.2 `server/internal/ws/protocol.go`

- `ClientMessage` gains `Team []string \`json:"team,omitempty"\``.
- `PlayerInfo` (ws package) gains `Team []string \`json:"team,omitempty"\`` — this flows into `player_list`, `game_start`, `player_joined`, and `player_left` payloads automatically. (`GameStartPayload`/`CombatPlayerInfo` are legacy-unused; leave untouched.)

## 5.3 `server/internal/ws/handler.go`

- `handleReady(conn, roomID, playerID, msg)` — pass `msg.Team` into `SetPlayerReady`.
- All `PlayerInfo` constructions gain `Team: p.Team`:
  - `handleJoin` (existing players + the joining player's `player_joined` broadcast)
  - `handleReady` game_start players
  - `handlePlayAgain` return-to-lobby `player_list`
  - `HandleDisconnect` `player_left` players
- `handleStartGame` — unchanged logic; `StartGame` now validates teams server-side (error surfaces via existing `sendError`).

**Breaking note:** clients that send `ready` without a team now get an error and are not marked ready. Both players run the same build, so this is safe.

---

# 6. Client: Battle Integration

## 6.1 `client/src/lib/ws.ts`

- Ready message: `{ type: 'ready'; team: Tier[] }`.
- `PlayerInfo` gains `team?: Tier[]`; `game_start` players gain `team?: Tier[]`.

## 6.2 `client/src/app/room/[id]/page.tsx`

- `Player` interface gains `team?: Team`.
- `player_list` / `player_joined` / `game_start` / `player_left` handlers: preserve the `team` field when mapping into `players` state.
- Derive `const opponentTeam: Team = opponentPlayer?.team ?? []`.
- `BattleStage` call: `opponentTeam={opponentTeam}` (replaces `DEFAULT_TEAM` import), drop `running` prop.
- `AttackSelector` gets `team={playerTeam}`.
- Remove `DEFAULT_TEAM` import.

## 6.3 `AttackSelector`

- New required prop `team: Team`. Filter the 7 `attacks` down to team members before rendering **and** in the `keydown` handler (keys outside the team do nothing).
- Keep each tier's **global** hotkey (a team member whose global key is `5` stays `5`).
- Empty team → render nothing (unreachable in battle due to gating).

## 6.4 `BattleStage`

- Remove `running` prop (pass-through to `ParallaxScene` gone).
- Empty teams render as no fighters (existing `.map` over `[]`); `resolveFocusSpot` fallback already handles missing tiers.

## 6.5 `ParallaxScene` (static)

New minimal shape — no effects, no refs, no `running`:

```tsx
interface ParallaxSceneProps { battleground: Battleground }

// render: layers.map((layer, index) => (
//   <img key={layer.id} src={layer.image} alt="" draggable={false}
//        className={`absolute inset-0 w-full h-full object-cover ${anchorClass(layer.anchor)}`}
//        style={{ zIndex: index }} />
// ))
```

- Delete `client/src/components/battle/parallax.ts` and `parallax.test.ts` (`PAN_SPEED`, `advanceParallaxOffset`, `layerTranslate` become unused).
- `BattleStage` stops passing `running`; `page.tsx` stops passing it too.
- Zooming in only ever *crops* edges (`scale ≥ 1`), so single copies never expose gaps — the 200% tiling is safe to remove.

---

# 7. Edge Cases

| Case | Behavior |
|------|----------|
| New player, no saved team | Picker empty, `getTeam()` → `[]`; Ready/Start disabled until 4/4. |
| Returning player with saved team | Picker pre-fills; can still edit (draft persistence); Ready requires 4. |
| Player picks 3 and leaves | Draft saved (3/4); next visit shows 3; must add a 4th. |
| Partial edit down from 4 to 3 | Persisted as 3; gating re-engages. |
| Ready already pressed, team changed | Picker locks after Ready (`disabled={... \|\| isReady}`); committed team stays valid. |
| Rematch (`return_to_lobby`) | Team persists server-side and in localStorage; picker re-enables, ready resets. |
| Disconnect / rejoin | `player_list` includes teams, opponent fighters re-render correctly. |
| Malicious client skips team | Server rejects ready and every out-of-team attack with an error. |
| Empty team reaches `BattleStage` | Renders no fighters; unreachable after gating. |

---

# 8. Testing

## Client (Vitest)

- **`team.test.ts`** — rewrite: `getTeam()` → `[]` when empty/corrupt/SSR; `saveTeam` accepts drafts (0–4) and rejects dupes/bad tiers; round-trip; `isValidTeam` still exactly-4.
- **`TeamPicker.test.tsx`** (new) — renders 7 cards; caps at 4; click toggles; order badges; counter text; `disabled` blocks clicks.
- **`AttackSelector.test.tsx`** — team prop filters rendered buttons + key handler; existing cases updated for required prop.
- **`PlayerList.test.tsx`** — Ready disabled without `teamComplete`; Start disabled without host `teamComplete`; existing cases updated.
- **`ParallaxScene.test.tsx`** — rewrite: exactly `layers.length` images, no panning/running.
- **`BattleStage.test.tsx`** — drop `running`; opponent team rendered from prop (not default).
- **`ws.test.ts`** — ready serializes `team`; `PlayerInfo.team` parsed.
- **`page.test.tsx`** — ready sends team; opponent team from server; existing flow tests updated.

## Server (`go test ./...`)

- **`room_test.go`** — `SetPlayerReady`: valid team marks ready / returns allReady; invalid (3 tiers, duplicate, unknown tier, missing) → error, not ready. `SelectAttack`/`SwitchAttack`/`CompleteAttack`: in-team tier OK, out-of-team tier rejected. `StartGame`: rejects when any player lacks a valid team.
- **`ws` handler tests** — `handleReady` with team works; without team → error message. `player_list` payload includes each player's team.
- **Integration tests** — update existing flows to send a team with `ready`.

## Regression

- `npm run lint` (0 errors), `npm run build`, all client tests; `go test ./...` all green.
- Battle HUD (HP bars, timer, TypingArea, floating damage) still renders during `countdown`/`playing`.

---

# 9. Out of Scope / Future

- Live team editing after ready (no `team_update` / un-ready message yet).
- Real character sprites / attack animations (`SPRITE_MAP` unchanged).
- New battlegrounds (manifest + server list).
- Camera zoom on the opponent's attack, mid-typing camera drift.
- New messages for a dedicated team-change flow (client currently commits team at ready).

# End of Specification
