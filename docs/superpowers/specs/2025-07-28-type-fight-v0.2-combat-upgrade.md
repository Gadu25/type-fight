# Type-Fight v0.2 - Combat Upgrade Design

Version: 0.2  
Project: Type-Fight  
Status: Design Approved

---

## 1. Overview

Version 0.2 transforms Type-Fight from a WPM typing race into a real-time combat system. Players choose attack types, type unique phrases, and deal damage based on accuracy. The server remains authoritative on damage calculation and HP tracking.

**Scope:** HP system, attack selection, multiple phrases, damage calculation, battle ending condition. No character selection or visual overhaul.

---

## 2. Approach: Client-Driven Events

Player selects attack → server provides phrase → player types locally → sends completion event → server applies damage.

- Minimal WebSocket traffic during typing
- Server authoritative on damage and HP
- Clean separation between typing (client) and combat (server)

---

## 3. Data Model

### PlayerState (server-side, extends current)

```
PlayerState:
  ID: string
  Name: string
  HP: int                    // default 1000
  CurrentAttack: string      // "quick"|"normal"|"heavy"|"ultimate"|""
  CurrentPhrase: string
  PhrasePosition: int
  PhraseCorrect: int
  AttackStartTime: time.Time
  IsAlive: bool
  Finished: bool
  Ready: bool
  WantsPlayAgain: bool
```

### Room (server-side, extends current)

```
Room:
  ID: string
  Players: map[string]*PlayerState
  HostID: string
  Status: string             // "waiting"|"lobby"|"playing"|"finished"
  Winner: string
  BattleStartTime: time.Time
  BattleTimeLimit: duration  // 120 seconds
```

### Attack Definitions (server-side constants)

```
Quick:    { Damage: 80,  PhraseWords: "4-8" }
Normal:   { Damage: 180, PhraseWords: "8-15" }
Heavy:    { Damage: 350, PhraseWords: "15-25" }
Ultimate: { Damage: 600, PhraseWords: "25-40" }
```

---

## 4. WebSocket Protocol

### New Client → Server Messages

| Message | Fields | Purpose |
|---------|--------|---------|
| `select_attack` | `{ tier: string }` | Player selects attack type |
| `attack_complete` | `{ correct: int, total: int }` | Player finishes typing phrase |
| `switch_attack` | `{ tier: string }` | Player abandons current attack, picks new one |

### New Server → Client Messages

| Message | Fields | Purpose |
|---------|--------|---------|
| `attack_phrase` | `{ phrase: string, tier: string, damage: int }` | Phrase assigned for attack |
| `hp_update` | `{ playerID: string, hp: int, attacker: string, damage: int }` | HP changed after attack |
| `player_defeated` | `{ playerID: string }` | Player reached 0 HP |
| `battle_over` | `{ winner: string, reason: string }` | Battle ended |

### Removed Messages

| Message | Reason |
|---------|--------|
| `keystroke` | Replaced by `attack_complete` |
| `progress` | Replaced by `hp_update` |
| `player_finished` | Replaced by `player_defeated` |

### Modified Messages

| Message | Changes |
|---------|---------|
| `game_start` | Includes both players' HP (1000) |
| `play_again` | Resets HP to 1000, clears attack state |

---

## 5. Game Flow

1. Both players ready up → `game_start` sent with HP = 1000
2. Players see attack selection UI (keys 1-4)
3. Player presses 1-4 → sends `select_attack`
4. Server picks random phrase from tier pool → sends `attack_phrase`
5. Player types phrase locally (no keystrokes sent to server)
6. Player finishes → sends `attack_complete` with `{ correct, total }`
7. Server calculates: `accuracy = correct / total`, `damage = baseDamage * accuracy`
8. Server updates opponent HP → broadcasts `hp_update`
9. If opponent HP ≤ 0 → `player_defeated` + `battle_over`
10. Repeat from step 3

### Attack Switching

- Player presses 1-4 while typing → sends `switch_attack`
- Server discards current phrase progress
- Server picks new phrase from new tier → sends new `attack_phrase`
- No penalty beyond lost time

### Timeout

- 120 second battle timer
- If timer expires: player with more HP wins
- If tied HP: player with higher accuracy wins
- If still tied: draw

### Play Again

- Resets HP to 1000
- Clears attack state
- Returns to lobby

---

## 6. Client-Side Components

### New Components

| Component | Purpose |
|-----------|---------|
| `AttackSelector` | Shows 4 attack options (1-4 keys), highlights current, shows damage/phrase length |
| `HealthBar` | HP bar for both players, animates on damage |
| `BattleTimer` | 120s countdown timer |

### Modified Components

| Component | Changes |
|-----------|---------|
| `Room page` | Add battle state, HP tracking, attack selection logic |
| `TypingArea` | Accepts wrong characters (shows red), requires backspace to correct |
| `Results` | Show total damage dealt, accuracy per attack |

### Battle Layout

```
┌─────────────────────────────────────┐
│  [HP Bar: ████████████░░░] Player1  │
│  [HP Bar: ██████░░░░░░░░] Player2  │
│                                     │
│  [1] Quick  [2] Normal             │
│  [3] Heavy  [4] Ultimate           │
│                                     │
│  "The ancient warrior entered..."   │
│  ▲ cursor                           │
│                                     │
│  Attack: Normal (180 dmg)           │
│  Accuracy: 85%                      │
│  Time: 0:45                         │
└─────────────────────────────────────┘
```

---

## 7. Phrase System

### Generic Phrase Pools

```
phrases = {
  quick: [
    "The sword shines bright",
    "Fire burns through darkness",
    "Strike fast and true",
    "The blade catches light",
    "Steel sings through air"
  ],
  normal: [
    "The warrior entered the ancient battlefield with courage and honor",
    "Magic flows through the veins of the forgotten forest at dawn"
  ],
  heavy: [
    "The forgotten kingdom was protected by ancient warriors who fought without fear",
    "Darkness spread across the land as the dragon descended from the mountain peaks"
  ],
  ultimate: [
    "The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon",
    "When the final battle began the warriors knew there was no turning back from the path they had chosen"
  ]
}
```

### Phrase Selection

- Server picks random phrase from tier's array
- Each player gets their own phrase (not shared)
- Phrases are 4-8 / 8-15 / 15-25 / 25-40 words per tier

### Backspace Handling (per spec Section 9.1)

- Typing wrong character: shows red, cursor doesn't advance
- Press backspace: removes last correct character
- Time continues flowing during correction
- Accuracy calculated at completion: `correct / total`

---

## 8. Server-Side Logic Changes

### game/engine.go

Add:
- `CalculateDamage(baseDamage, accuracy)` → `baseDamage * accuracy`
- `CheckBattleTimeout(startTime, limit)` → true if time exceeded
- `GetAttackDef(tier)` → attack definition (damage, phrase length)
- `GetRandomPhrase(tier)` → random phrase from pool
- Constants: `BattleTimeLimit = 120s`, attack damage values

### game/room.go

Add to PlayerState: HP, CurrentAttack, CurrentPhrase, PhraseCorrect, PhrasePosition, AttackStartTime, IsAlive

Add to Room: Winner, BattleStartTime, BattleTimeLimit

Add methods:
- `SelectAttack(playerID, tier)` → picks phrase, sets state
- `CompleteAttack(playerID, correct, total)` → calculates damage, updates HP
- `SwitchAttack(playerID, newTier)` → discards current, picks new phrase
- `CheckBattleEnd()` → checks HP ≤ 0 or timeout

Remove: `UpdatePlayerPosition` (replaced by attack flow)

### ws/handler.go

Add handlers:
- `handleSelectAttack` → validates tier, calls SelectAttack
- `handleAttackComplete` → validates player, calls CompleteAttack
- `handleSwitchAttack` → validates tier, calls SwitchAttack

Modify:
- `handleReady` → starts 120s battle timer
- `handlePlayAgain` → resets HP

Remove: `handleKeystroke`

### ws/protocol.go

Add new message types, remove old ones.

### game/words.go

Replace 20 generic quotes with tiered phrase pools.

---

## 9. Testing Strategy

- Unit tests for damage calculation, accuracy, attack definitions
- Integration tests for WebSocket battle flow
- Manual testing: 2-player battle with attack switching, HP updates, timeout

---

## 10. Out of Scope

- Character selection (v0.4)
- Visual overhaul (v0.3)
- Database/accounts (v1.0)
- Equipment/skills/progression
