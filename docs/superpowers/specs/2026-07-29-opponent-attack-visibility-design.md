# Opponent Attack Visibility + Arena Layout

**Date:** 2026-07-29
**Status:** Approved
**Project:** Type-Fight

---

## Problem

During combat, players can only see their own attack and typing area. The opponent's screen is invisible — you have no idea what attack they've chosen or whether they're typing. This makes the game feel like a single-player typing test that occasionally flashes damage numbers, rather than a real-time duel.

## Solution

Two changes:

1. **Broadcast `opponent_attack`** — when any player selects or switches attacks, the server echoes the tier to all clients. Each client shows the opponent's attack as a colored badge.
2. **Arena layout polish** — wrap the combat area in a styled panel, add HP glow on damage, and position attack badges above each HP bar. No layout restructure.

---

## Server Changes

### New protocol type

Add to `server/internal/ws/protocol.go` — `CombatServerMessage`:

```go
OpponentAttack *OpponentAttackPayload `json:"opponent_attack,omitempty"`
```

New struct:

```go
type OpponentAttackPayload struct {
    PlayerID string `json:"playerID"`
    Tier     string `json:"tier"`
}
```

### Handler changes

In both `handleSelectAttack` and `handleSwitchAttack` in `server/internal/ws/handler.go`, after the existing `roomManager.SelectAttack(...)` / `roomManager.SwitchAttack(...)` call succeeds:

```go
broadcast := CombatServerMessage{
    Type: "opponent_attack",
    OpponentAttack: &OpponentAttackPayload{
        PlayerID: playerID,
        Tier:     msg.SelectAttack.Tier, // or msg.SwitchAttack.Tier
    },
}
data, _ := json.Marshal(broadcast)
h.hub.BroadcastToRoom(roomID, data)
```

No new business logic. No additional validation — the tier was already validated by `SelectAttack`/`SwitchAttack`.

---

## Client Changes

### New message handler

In `page.tsx`, add state:

```ts
const [opponentAttack, setOpponentAttack] = useState<string>('')
```

Add to the message switch:

```ts
case 'opponent_attack':
    if (message.opponent_attack.playerID !== playerId) {
        setOpponentAttack(message.opponent_attack.tier)
    }
    break
```

Reset in `game_start` and `return_to_lobby` cases alongside existing state resets.

### New ws.ts type

Add `opponent_attack` to the `ServerMessage` type union:

```ts
opponent_attack?: { playerID: string; tier: string }
```

### Attack badge rendering

Render a small badge above each HP bar showing the current attack tier with an icon:

| Tier   | Icon | Color   |
|--------|------|---------|
| quick  | ⚡   | yellow  |
| normal | ⚔️   | gray    |
| heavy  | 🛡️   | purple  |
| ultimate | 💥 | red   |

Player's own badge (left side) reads from existing `currentAttack` state. Opponent's badge (right side) reads from new `opponentAttack` state.

Badge disappears when the attack is completed (player's resets when `currentPhrase` is cleared; opponent's is overwritten on next `opponent_attack` or `hp_update`).

### Arena panel

Wrap the existing combat section (`countdown || playing` block) with:

```tsx
<div className="relative bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700 p-6 shadow-lg">
```

This adds a subtle arena feel without changing the inner layout.

### HP glow on damage

Add to the existing HP bar container inline style:

```tsx
style={{
    boxShadow: playerDamageFlash > 0 ? '0 0 20px rgba(239,68,68,0.5)' : 'none',
    transition: 'box-shadow 0.3s ease-out',
}}
```

Same for opponent's side using `opponentDamageFlash`.

---

## What Stays the Same

| Concern | Status |
|---------|--------|
| `handleSelectAttack`/`handleSwitchAttack` server logic | Identical — attack badge is an additional broadcast |
| `handleAttackComplete` server logic | Unchanged |
| `hp_update` broadcast | Unchanged |
| `battle_over` / `player_defeated` | Unchanged |
| TypingArea flow | Unchanged |
| AttackSelector flow | Unchanged |
| Combo streak / floating numbers | Unchanged |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Opponent picks attack before you've finished typing | Badge appears above their HP bar — you see they're preparing |
| Opponent switches attack mid-type | `opponent_attack` fires again — badge updates immediately |
| Both players attack simultaneously | Each sees the other's badge; no race condition |
| Disconnect mid-attack | Existing disconnect handling — badge disappears on `player_left` → `return_to_lobby` |
| Player attacks themselves (impossible) | Server `CompleteAttack` rejects — no `opponent_attack` for this case |

---

## Files Changed

| File | Change |
|------|--------|
| `server/internal/ws/protocol.go` | Add `OpponentAttackPayload` struct + field on `CombatServerMessage` |
| `server/internal/ws/handler.go` | Broadcast `opponent_attack` in `handleSelectAttack` and `handleSwitchAttack` |
| `server/internal/ws/protocol_test.go` | Test new message type |
| `server/internal/ws/handler_test.go` | Test broadcast behavior |
| `client/src/lib/ws.ts` | Add `opponent_attack` to TypeScript types |
| `client/src/app/room/[id]/page.tsx` | Handle `opponent_attack` message, render attack badges, arena panel, HP glow |
