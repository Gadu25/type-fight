# Client-Side Phrase Generation Design

**Date:** 2026-07-29
**Status:** Approved
**Project:** Type-Fight

---

## Problem

The current attack flow has two sequential round-trips between attacks:

```
attack_complete → (player chooses) → select_attack → (server generates) → attack_phrase → (phrase appears)
```

On a cross-region or mobile connection, this causes 200–600ms of dead air between attacks — the typing area goes blank, the player waits, and the combo feel breaks.

## Solution

Move phrase selection/generation to the client. The client holds a local copy of the phrase pools (synced from server at room start) and picks a phrase instantly when the player selects an attack.

The server validates the phrase on `attack_complete` against its own pool, preventing the "claim heavy damage on a 3-word phrase" exploit.

---

## Flow

### Game Setup

Server sends phrase pools once to both clients:

```json
{
  "type": "game_setup",
  "phrase_pools": {
    "quick": ["The sword shines bright", ...],
    "normal": ["The warrior entered the ancient battlefield...", ...],
    "heavy": ["The forgotten kingdom was protected...", ...],
    "ultimate": ["The ancient civilization discovered...", ...]
  }
}
```

Sent when room transitions to `"playing"` state, alongside or after `game_start`.

### Attack Selection

1. Player presses `1`/`2`/`3`/`4` or clicks an attack button
2. Client: picks a random phrase from the local pool for that tier
3. Client: instantly displays the phrase in TypingArea (zero latency)
4. Client: sends `select_attack { tier }` to server
5. Server: validates tier exists, stores `CurrentAttack = tier` on player state

### Attack Completion

1. Player finishes typing the phrase
2. Client sends `attack_complete { tier, phrase, correct, total }`
3. Server validates:
   - `tier` is a valid attack tier
   - `phrase` exists in `pool[tier]`
   - `correct` > 0 and `correct <= len(phrase)`
   - `total >= correct` and `total <= len(phrase) * 3`
   - Accuracy floor at 25% (`correct/total >= 0.25`)
4. Server calculates accuracy and damage (identical to current logic)
5. Server broadcasts `hp_update`
6. Player sees outcome and picks next attack — AttackSelector is always visible

### Attack Switching

1. Player presses a different number while typing
2. Client: discards current phrase, picks new random phrase for new tier, resets typing position
3. Client: sends `switch_attack { tier }` to server
4. Server: updates `CurrentAttack`

If a race condition occurs (`attack_complete` arrives before `switch_attack`), the server rejects because the phrase doesn't match the stored tier's pool. Client re-sends on error. In practice this is extremely rare because the player types for seconds after switching.

---

## Protocol Changes

### New server → client message

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"game_setup"` | |
| `phrase_pools` | `Record<string, string[]>` | Pool of phrases per tier |

### Modified client → server messages

**`attack_complete`** gains two fields:

| Field | Type | Description |
|-------|------|-------------|
| `tier` | `string` | `"quick"`, `"normal"`, `"heavy"`, or `"ultimate"` |
| `phrase` | `string` | The exact phrase that was typed |
| `correct` | `int` | Correct keystrokes (unchanged) |
| `total` | `int` | Total keystrokes (unchanged) |

### Removed server → client message

- `attack_phrase` — no longer sent; client generates phrases locally

---

## What Stays the Same

| Concern | Status |
|---------|--------|
| Damage calculation | `base[tier] * correct/total` — unchanged |
| Accuracy calculation | `correct/total` — unchanged, still server-side |
| WPM calculation | Client-side `totalCorrect/5/elapsed` — unchanged |
| `select_attack` handler | Tier validation + `CurrentAttack` set — unchanged |
| `switch_attack` handler | Tier validation + `CurrentAttack` update — unchanged |
| `hp_update` broadcast | Identical payload and flow |
| `battle_over` / `player_defeated` | Identical |
| `handleAttackComplete` flow | Same structure, adds validation step |
| PlayerState fields | `CurrentAttack` kept; `CurrentPhrase`/`PhraseTotal`/etc become unused |

---

## Server Validation Rules

Added to `CompleteAttack`:

```
1. tier ∈ {quick, normal, heavy, ultimate}
2. phrase ∈ pool[tier]
3. correct ∈ [1, len(phrase)]
4. total ∈ [correct, len(phrase) * 3]
5. accuracy = max(correct/total, 0.25)
```

Rules 3–5 prevent manipulation. The 25% floor ensures even a badly-typed attack does chip damage (no "miss" mechanics in this version).

---

## Client Changes

### `ws.ts`
- Add `game_setup` to `ServerMessage` type union
- Add `tier` and `phrase` fields to the `attack_complete` message
- Remove `attack_phrase` from `ServerMessage` type union

### `page.tsx`
- Store phrase pools in a ref or state after receiving `game_setup`
- `handleSelectAttack`: pick random phrase from local pool, set `currentPhrase` immediately
- `handleAttackComplete`: include `tier` and `phrase` in the message payload
- Remove handling of `attack_phrase` message

### `words.ts` (new client file)
- Mirror the phrase pool structure from `server/internal/game/words.go`
- Export `getRandomPhrase(tier)` to encapsulate pool access

### `AttackSelector.tsx`
- No changes needed — already fires `onSelect` on click/keypress

### `TypingArea.tsx`
- No changes needed — already resets on `phrase` prop change

---

## Combo Visual Feedback

No mechanical combo multiplier. Pure visual/pacing polish:

- **Streak counter**: track consecutive successful attacks client-side; show "3x" badge that fades after 5s of inactivity
- **Damage shake**: existing shake intensity already scales with damage; can optionally factor in streak for visual escalation
- **Smooth HP transitions**: animated health bar interpolation (CSS transition on `width`)
- **Floating damage numbers**: `+87` floats up from opponent's HP bar on each hit
- **No dead screen**: phrase instantly replaces itself; typing area never goes blank

---

## Edge Cases

| Case | Handling |
|------|----------|
| First attack at game start | AttackSelector visible from countdown; player picks immediately after `playing` |
| Dead player sending attacks | Server rejects — `IsAlive` check already exists |
| Phrase pool version drift | Server is authoritative; `game_setup` sends current pools at game start |
| Disconnect mid-attack | Existing `HandleDisconnect` handles it — opponent gets forfeit win |
| Very fast switching | Server rejects mismatched tier/phrase; client retries |
