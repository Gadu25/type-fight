# Client-Side Phrase Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move attack phrase generation from server to client to eliminate the round-trip latency between attack completion and next phrase appearing.

**Architecture:** Server pushes phrase pools to clients at game start. Client picks phrases locally from the pool. Server validates the phrase on `attack_complete` before calculating damage. No changes to damage/accuracy/WPM logic.

**Tech Stack:** Go (server), Next.js 15 + React 19 + TypeScript (client), WebSocket

## Global Constraints

- All client changes use 'use client' directive
- Follow existing patterns in codebase
- Go server uses sync.RWMutex for thread safety
- No new dependencies
- Phrase pools are the authoritative source from the server

---

### Task 1: Client — Create words.ts utility

**Files:**
- Create: `client/src/lib/words.ts`

**Interfaces:**
- Consumes: phrase pool structure matching `server/internal/game/words.go`
- Produces: `phrasePools` constant, `getRandomPhrase(tier)` function

- [ ] **Step 1: Create words.ts with phrase pools**

Create `client/src/lib/words.ts`:

```typescript
type Tier = 'quick' | 'normal' | 'heavy' | 'ultimate'

const phrasePools: Record<Tier, string[]> = {
  quick: [
    'The sword shines bright',
    'Fire burns through darkness',
    'Strike fast and true',
    'The blade catches light',
    'Steel sings through air',
    'Swift as the wind',
    'Precision cuts deep',
    'Aim true strike hard',
  ],
  normal: [
    'The warrior entered the ancient battlefield with courage and honor',
    'Magic flows through the veins of the forgotten forest at dawn',
    'The knight raised his sword and charged into the heart of battle',
    'Shadows dance across the moonlit battlefield as arrows fly',
    'The ancient stones hold secrets of battles fought long ago',
  ],
  heavy: [
    'The forgotten kingdom was protected by ancient warriors who fought without fear',
    'Darkness spread across the land as the dragon descended from the mountain peaks',
    'The iron fortress stood tall against the endless tide of invaders seeking glory',
    'Thunder roared across the sky as the armies clashed beneath the storm',
  ],
  ultimate: [
    'The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon',
    'When the final battle began the warriors knew there was no turning back from the path they had chosen',
    'The legendary sword was forged in dragon fire and quenched in the tears of a thousand fallen heroes',
  ],
}

export function getRandomPhrase(tier: Tier): string {
  const pool = phrasePools[tier]
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]
}

export function getPhrasePool(tier: Tier): string[] {
  return phrasePools[tier]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/words.ts
git commit -m "feat: add client-side phrase pools and getRandomPhrase"
```

---

### Task 2: Server — Add game_setup message and phrase pool export

**Files:**
- Modify: `server/internal/game/words.go`
- Modify: `server/internal/ws/protocol.go`

**Interfaces:**
- Consumes: existing phrase pool structure
- Produces: `GetPhrasePools()` function, `GameSetupMessage` type

- [ ] **Step 1: Add GetPhrasePools export to words.go**

In `server/internal/game/words.go`, add after `GetRandomText`:

```go
func GetPhrasePools() map[string][]string {
    pools := make(map[string][]string)
    for tier, phrases := range phrasePools {
        pool := make([]string, len(phrases))
        copy(pool, phrases)
        pools[tier] = pool
    }
    return pools
}
```

- [ ] **Step 2: Add new fields to ServerMessage in protocol.go**

Add to `ServerMessage` struct:

```go
PhrasePools  map[string][]string `json:"phrase_pools,omitempty"`
```

- [ ] **Step 3: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/internal/game/words.go server/internal/ws/protocol.go
git commit -m "feat: add GetPhrasePools and phrase_pools field to ServerMessage"
```

---

### Task 3: Server — Send game_setup at game start

**Files:**
- Modify: `server/internal/ws/handler.go`

- [ ] **Step 1: Broadcast game_setup after game start**

In `handler.go`, find where `game_start` is broadcast (inside `handleReady` after line 134, and in `handleStartGame` after line 228). After each broadcast of `game_start`, add:

```go
setupMsg := ServerMessage{
    Type:        "game_setup",
    PhrasePools: game.GetPhrasePools(),
}
setupData, _ := json.Marshal(setupMsg)
h.hub.BroadcastToRoom(roomID, setupData)
```

There are two places this needs to be added:
1. Inside `handleReady` (around line 134-142) — after `h.hub.BroadcastToRoom(roomID, startData)`
2. Inside `handleStartGame` (around line 235-236) — after `h.hub.BroadcastToRoom(roomID, data)`

- [ ] **Step 2: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/internal/ws/handler.go
git commit -m "feat: broadcast game_setup with phrase pools at game start"
```

---

### Task 4: Client — Handle game_setup and remove attack_phrase handling

**Files:**
- Modify: `client/src/lib/ws.ts`
- Modify: `client/src/app/room/[id]/page.tsx`

- [ ] **Step 1: Update ws.ts types**

In `client/src/lib/ws.ts`:

1. Add `game_setup` to `ServerMessage` type:
```typescript
| { type: 'game_setup'; phrase_pools: Record<string, string[]> }
```

2. Remove `attack_phrase` from `ServerMessage` type (delete the line):
```typescript
// DELETE this line:
// | { type: 'attack_phrase'; attack_phrase: { phrase: string; tier: string; damage: number } }
```

3. Update `attack_complete` in `ClientMessage` to include tier and phrase:
```typescript
| { type: 'attack_complete'; attack_complete: { tier: 'quick' | 'normal' | 'heavy' | 'ultimate'; phrase: string; correct: number; total: number } }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Update page.tsx to handle game_setup**

In `client/src/app/room/[id]/page.tsx`:

Add import:
```typescript
import { getRandomPhrase } from '@/lib/words'
```

Add state ref for phrase pools:
```typescript
const phrasePoolsRef = useRef<Record<string, string[]> | null>(null)
```

Add handler in `handleMessage` switch for `game_setup`:
```typescript
case 'game_setup':
  if (message.phrase_pools) {
    phrasePoolsRef.current = message.phrase_pools
  }
  break
```

Remove the `attack_phrase` case from `handleMessage` (delete the entire case block).

- [ ] **Step 4: Update handleSelectAttack to pick phrase locally**

Replace the existing `handleSelectAttack` callback:

```typescript
const handleSelectAttack = useCallback((tier: 'quick' | 'normal' | 'heavy' | 'ultimate') => {
  const phrase = getRandomPhrase(tier)
  setCurrentPhrase(phrase)
  setCurrentAttack(tier)
  const def = attackDefs[tier]
  setCurrentDamage(def)
  if (wsRef.current) {
    sendMessage(wsRef.current, { type: 'select_attack', select_attack: { tier } })
  }
}, [])
```

Add attack defs at component top (after the BATTLE_TIME_LIMIT constant):
```typescript
const attackDefs: Record<string, number> = {
  quick: 80,
  normal: 180,
  heavy: 350,
  ultimate: 600,
}
```

- [ ] **Step 5: Update handleAttackComplete to send tier and phrase**

Replace the existing `handleAttackComplete` callback:

```typescript
const handleAttackComplete = useCallback((result: { correct: number; total: number }) => {
  totalCorrectCharsRef.current += result.correct
  totalKeystrokesRef.current += result.total
  if (wsRef.current && currentAttack) {
    sendMessage(wsRef.current, {
      type: 'attack_complete',
      attack_complete: {
        tier: currentAttack as 'quick' | 'normal' | 'heavy' | 'ultimate',
        phrase: currentPhrase,
        correct: result.correct,
        total: result.total,
      },
    })
  }
  setCurrentPhrase('')
  setCurrentAttack('')
}, [currentAttack, currentPhrase])
```

- [ ] **Step 6: Handle switch_attack locally**

Add to the existing `handleSelectAttack` — since pressing 1-4 while a phrase is active is a switch, the same function handles both. Add a dedicated switch handler in the attack selector. Update AttackSelector usage to also pass a switch callback, or just use the same `handleSelectAttack` (since the client now always picks a new phrase locally regardless).

The existing code in `page.tsx` already uses `handleSelectAttack` for both select and switch. Since the client always picks a phrase locally on any attack selection, this works for both cases. No additional changes needed.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add client/src/lib/ws.ts client/src/app/room/\[id\]/page.tsx
git commit -m "feat: handle game_setup, remove attack_phrase, pick phrases locally"
```

---

### Task 5: Server — Remove attack_phrase responses and add phrase validation

**Files:**
- Modify: `server/internal/game/room.go`
- Modify: `server/internal/ws/handler.go`

- [ ] **Step 1: Update SelectAttack to not generate a phrase**

In `server/internal/game/room.go`, replace `SelectAttack`:

```go
func (rm *RoomManager) SelectAttack(playerID, tier string) error {
    def := GetAttackDef(tier)
    if def.Damage == 0 {
        return fmt.Errorf("invalid attack tier: %s", tier)
    }
    rm.mu.RLock()
    defer rm.mu.RUnlock()
    for _, room := range rm.rooms {
        room.mu.Lock()
        player, exists := room.Players[playerID]
        if !exists {
            room.mu.Unlock()
            continue
        }
        player.CurrentAttack = tier
        room.mu.Unlock()
        return nil
    }
    return fmt.Errorf("player not found")
}
```

- [ ] **Step 2: Update SwitchAttack to not generate a phrase**

Replace `SwitchAttack`:

```go
func (rm *RoomManager) SwitchAttack(playerID, newTier string) error {
    def := GetAttackDef(newTier)
    if def.Damage == 0 {
        return fmt.Errorf("invalid attack tier: %s", newTier)
    }
    rm.mu.RLock()
    defer rm.mu.RUnlock()
    for _, room := range rm.rooms {
        room.mu.Lock()
        player, exists := room.Players[playerID]
        if !exists {
            room.mu.Unlock()
            continue
        }
        player.CurrentAttack = newTier
        room.mu.Unlock()
        return nil
    }
    return fmt.Errorf("player not found")
}
```

- [ ] **Step 3: Add phrase validation to CompleteAttack**

Replace `CompleteAttack`:

```go
func (rm *RoomManager) CompleteAttack(playerID, tier, phrase string, correct, total int) (*AttackResult, error) {
    rm.mu.RLock()
    defer rm.mu.RUnlock()
    for _, room := range rm.rooms {
        room.mu.Lock()
        attacker, exists := room.Players[playerID]
        if !exists {
            room.mu.Unlock()
            continue
        }
        if attacker.CurrentAttack == "" {
            room.mu.Unlock()
            return nil, fmt.Errorf("no active attack")
        }
        if attacker.CurrentAttack != tier {
            room.mu.Unlock()
            return nil, fmt.Errorf("attack tier mismatch")
        }

        def := GetAttackDef(tier)
        pool := phrasePools[tier]
        valid := false
        for _, p := range pool {
            if p == phrase {
                valid = true
                break
            }
        }
        if !valid {
            room.mu.Unlock()
            return nil, fmt.Errorf("invalid phrase for tier %s", tier)
        }
        if correct < 1 || correct > len(phrase) {
            correct = len(phrase)
        }
        if total < correct || total > len(phrase)*3 {
            total = correct
        }

        accuracy := CalculateAccuracy(correct, total)
        if accuracy < 0.25 {
            accuracy = 0.25
        }
        damage := CalculateDamage(def.Damage, accuracy)

        var result *AttackResult
        for id, p := range room.Players {
            if id != playerID && p.IsAlive {
                oldHP := p.HP
                p.HP -= damage
                if p.HP <= 0 {
                    p.HP = 0
                    p.IsAlive = false
                }
                result = &AttackResult{
                    OpponentID: id,
                    OldHP:      oldHP,
                    NewHP:      p.HP,
                    Damage:     oldHP - p.HP,
                }
            }
        }
        attacker.CurrentAttack = ""
        room.mu.Unlock()
        if result == nil {
            return nil, fmt.Errorf("no valid opponent found")
        }
        return result, nil
    }
    return nil, fmt.Errorf("player not found")
}
```

- [ ] **Step 4: Update handleSelectAttack in handler.go**

Replace `handleSelectAttack` — remove the phrase response:

```go
func (h *Handler) handleSelectAttack(conn Connection, roomID, playerID string, data []byte) {
    var msg CombatClientMessage
    if err := json.Unmarshal(data, &msg); err != nil {
        h.sendError(conn, "Invalid message format")
        return
    }
    if msg.SelectAttack == nil {
        h.sendError(conn, "Missing attack tier")
        return
    }
    err := h.roomManager.SelectAttack(playerID, msg.SelectAttack.Tier)
    if err != nil {
        h.sendError(conn, err.Error())
        return
    }
}
```

- [ ] **Step 5: Update handleSwitchAttack in handler.go**

Replace `handleSwitchAttack` — remove the phrase response:

```go
func (h *Handler) handleSwitchAttack(conn Connection, roomID, playerID string, data []byte) {
    var msg CombatClientMessage
    if err := json.Unmarshal(data, &msg); err != nil {
        h.sendError(conn, "Invalid message format")
        return
    }
    if msg.SwitchAttack == nil {
        h.sendError(conn, "Missing attack tier")
        return
    }
    err := h.roomManager.SwitchAttack(playerID, msg.SwitchAttack.Tier)
    if err != nil {
        h.sendError(conn, err.Error())
        return
    }
}
```

- [ ] **Step 6: Update handleAttackComplete in handler.go**

Replace the existing `handleAttackComplete` to use the new `CompleteAttack` signature:

```go
func (h *Handler) handleAttackComplete(conn Connection, roomID, playerID string, data []byte) {
    var msg CombatClientMessage
    if err := json.Unmarshal(data, &msg); err != nil {
        h.sendError(conn, "Invalid message format")
        return
    }
    if msg.AttackComplete == nil {
        h.sendError(conn, "Missing attack data")
        return
    }

    attackResult, err := h.roomManager.CompleteAttack(
        playerID,
        msg.AttackComplete.Tier,
        msg.AttackComplete.Phrase,
        msg.AttackComplete.Correct,
        msg.AttackComplete.Total,
    )
    if err != nil {
        h.sendError(conn, err.Error())
        return
    }

    hpUpdate := CombatServerMessage{
        Type: "hp_update",
        HpUpdate: &HpUpdatePayload{
            PlayerID: attackResult.OpponentID,
            HP:       attackResult.NewHP,
            Attacker: playerID,
            Damage:   attackResult.Damage,
        },
    }
    hpData, _ := json.Marshal(hpUpdate)
    h.hub.BroadcastToRoom(roomID, hpData)

    winner, defeated := h.roomManager.CheckBattleEnd()
    if winner != "" && defeated != "" {
        defeatedMsg := CombatServerMessage{
            Type: "player_defeated",
            PlayerDefeated: &PlayerDefeatedPayload{
                PlayerID: defeated,
            },
        }
        defData, _ := json.Marshal(defeatedMsg)
        h.hub.BroadcastToRoom(roomID, defData)

        battleOver := CombatServerMessage{
            Type: "battle_over",
            BattleOver: &BattleOverPayload{
                Winner: winner,
                Reason: "opponent_defeated",
            },
        }
        boData, _ := json.Marshal(battleOver)
        h.hub.BroadcastToRoom(roomID, boData)

        h.roomManager.SetRoomStatus(roomID, "finished")
    }
}
```

- [ ] **Step 7: Update AttackCompletePayload in protocol.go**

In `server/internal/ws/protocol.go`, update `AttackCompletePayload`:

```go
type AttackCompletePayload struct {
    Tier    string `json:"tier"`
    Phrase  string `json:"phrase"`
    Correct int    `json:"correct"`
    Total   int    `json:"total"`
}
```

- [ ] **Step 8: Remove attack_phrase from CombatServerMessage (optional, for cleanliness)**

In `server/internal/ws/protocol.go`, in `CombatServerMessage`:
```go
// Remove this line:
// AttackPhrase *AttackPhrasePayload `json:"attack_phrase,omitempty"`
```

Also remove the `AttackPhrasePayload` struct if nothing else references it.

- [ ] **Step 9: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add server/internal/game/room.go server/internal/ws/handler.go server/internal/ws/protocol.go
git commit -m "feat: remove attack_phrase responses, add phrase validation to CompleteAttack"
```

---

### Task 6: Update handler tests

**Files:**
- Modify: `server/internal/ws/handler_test.go`

- [ ] **Step 1: Update TestHandleSelectAttack_SendsPhrase**

Rename to `TestHandleSelectAttack` and update: since `attach_phrase` is no longer sent, just verify no error:

```go
func TestHandleSelectAttack_StoresAttack(t *testing.T) {
    conn := &TestConnection{}
    hub := NewHub()
    go hub.Run()
    defer hub.Stop()

    rm := game.NewRoomManager()
    room := rm.CreateRoom("host1", "Host Player")
    err := rm.JoinRoom(room.ID, "host1", "Host")
    if err != nil {
        t.Fatalf("failed to join host: %v", err)
    }
    err = rm.JoinRoom(room.ID, "player1", "Test Player")
    if err != nil {
        t.Fatalf("failed to join player: %v", err)
    }
    err = rm.StartGame(room.ID, "host1")
    if err != nil {
        t.Fatalf("failed to start game: %v", err)
    }

    hub.Register(&Client{
        Conn:     conn,
        RoomID:   room.ID,
        PlayerID: "player1",
    })
    time.Sleep(10 * time.Millisecond)

    handler := NewHandler(hub, rm)

    msg := CombatClientMessage{
        Type: "select_attack",
        SelectAttack: &SelectAttackPayload{
            Tier: "quick",
        },
    }
    data, _ := json.Marshal(msg)
    handler.handleSelectAttack(conn, room.ID, "player1", data)
    time.Sleep(10 * time.Millisecond)

    room = rm.GetRoom(room.ID)
    if room == nil {
        t.Fatal("room not found")
    }
    player := room.Players["player1"]
    if player.CurrentAttack != "quick" {
        t.Errorf("expected CurrentAttack 'quick', got '%s'", player.CurrentAttack)
    }
}
```

- [ ] **Step 2: Update TestHandleAttackComplete_AppliesDamage**

Update to pass tier and phrase in `AttackCompletePayload`:

```go
func TestHandleAttackComplete_AppliesDamage(t *testing.T) {
    conn := &TestConnection{}
    hub := NewHub()
    go hub.Run()
    defer hub.Stop()

    rm := game.NewRoomManager()
    room := rm.CreateRoom("host1", "Host Player")
    err := rm.JoinRoom(room.ID, "host1", "Host")
    if err != nil {
        t.Fatalf("failed to join host: %v", err)
    }
    err = rm.JoinRoom(room.ID, "player1", "Test Player")
    if err != nil {
        t.Fatalf("failed to join player: %v", err)
    }
    err = rm.StartGame(room.ID, "host1")
    if err != nil {
        t.Fatalf("failed to start game: %v", err)
    }

    hub.Register(&Client{
        Conn:     conn,
        RoomID:   room.ID,
        PlayerID: "player1",
    })
    time.Sleep(10 * time.Millisecond)

    handler := NewHandler(hub, rm)

    // Select an attack first
    selectMsg := CombatClientMessage{
        Type: "select_attack",
        SelectAttack: &SelectAttackPayload{
            Tier: "quick",
        },
    }
    selectData, _ := json.Marshal(selectMsg)
    handler.handleSelectAttack(conn, room.ID, "player1", selectData)
    time.Sleep(10 * time.Millisecond)

    // Complete the attack
    completeMsg := CombatClientMessage{
        Type: "attack_complete",
        AttackComplete: &AttackCompletePayload{
            Tier:    "quick",
            Phrase:  "The sword shines bright",
            Correct: 22,
            Total:   22,
        },
    }
    completeData, _ := json.Marshal(completeMsg)
    handler.handleAttackComplete(conn, room.ID, "player1", completeData)
    time.Sleep(10 * time.Millisecond)

    // Should have hp_update message
    foundHPUpdate := false
    for _, msgBytes := range conn.messages {
        var resp CombatServerMessage
        if err := json.Unmarshal(msgBytes, &resp); err != nil {
            continue
        }
        if resp.Type == "hp_update" {
            foundHPUpdate = true
            if resp.HpUpdate == nil {
                t.Fatal("expected hp_update payload")
            }
            if resp.HpUpdate.PlayerID != "host1" {
                t.Errorf("expected hp update for 'host1', got '%s'", resp.HpUpdate.PlayerID)
            }
            if resp.HpUpdate.Attacker != "player1" {
                t.Errorf("expected attacker 'player1', got '%s'", resp.HpUpdate.Attacker)
            }
            if resp.HpUpdate.Damage <= 0 {
                t.Errorf("expected positive damage, got %d", resp.HpUpdate.Damage)
            }
        }
    }
    if !foundHPUpdate {
        t.Error("expected hp_update message to be sent")
    }
}
```

- [ ] **Step 3: Update TestHandleSwitchAttack_DiscardsProgress**

Since `attack_phrase` is no longer sent, the test just verifies the tier was updated:

```go
func TestHandleSwitchAttack_UpdatesTier(t *testing.T) {
    conn := &TestConnection{}
    hub := NewHub()
    go hub.Run()
    defer hub.Stop()

    rm := game.NewRoomManager()
    room := rm.CreateRoom("host1", "Host Player")
    err := rm.JoinRoom(room.ID, "host1", "Host")
    if err != nil {
        t.Fatalf("failed to join host: %v", err)
    }
    err = rm.JoinRoom(room.ID, "player1", "Test Player")
    if err != nil {
        t.Fatalf("failed to join player: %v", err)
    }
    err = rm.StartGame(room.ID, "host1")
    if err != nil {
        t.Fatalf("failed to start game: %v", err)
    }

    hub.Register(&Client{
        Conn:     conn,
        RoomID:   room.ID,
        PlayerID: "player1",
    })
    time.Sleep(10 * time.Millisecond)

    handler := NewHandler(hub, rm)

    // Select an attack first
    selectMsg := CombatClientMessage{
        Type: "select_attack",
        SelectAttack: &SelectAttackPayload{Tier: "quick"},
    }
    selectData, _ := json.Marshal(selectMsg)
    handler.handleSelectAttack(conn, room.ID, "player1", selectData)
    time.Sleep(10 * time.Millisecond)

    // Switch to heavy
    switchMsg := CombatClientMessage{
        Type: "switch_attack",
        SwitchAttack: &SwitchAttackPayload{Tier: "heavy"},
    }
    switchData, _ := json.Marshal(switchMsg)
    handler.handleSwitchAttack(conn, room.ID, "player1", switchData)
    time.Sleep(10 * time.Millisecond)

    // Verify the CurrentAttack was updated
    room = rm.GetRoom(room.ID)
    if room == nil {
        t.Fatal("room not found")
    }
    player := room.Players["player1"]
    if player.CurrentAttack != "heavy" {
        t.Errorf("expected CurrentAttack 'heavy', got '%s'", player.CurrentAttack)
    }
}
```

- [ ] **Step 4: Update TestHandleAttackComplete_LethalSendsBattleOver**

Update to pass tier and phrase:

```go
func TestHandleAttackComplete_LethalSendsBattleOver(t *testing.T) {
    hostConn := &TestConnection{}
    p2Conn := &TestConnection{}
    hub := NewHub()
    go hub.Run()
    defer hub.Stop()

    rm := game.NewRoomManager()
    room := rm.CreateRoom("host1", "Host Player")
    err := rm.JoinRoom(room.ID, "host1", "Host")
    if err != nil {
        t.Fatalf("failed to join host: %v", err)
    }
    err = rm.JoinRoom(room.ID, "player1", "Test Player")
    if err != nil {
        t.Fatalf("failed to join player: %v", err)
    }
    err = rm.StartGame(room.ID, "host1")
    if err != nil {
        t.Fatalf("failed to start game: %v", err)
    }

    // Set host HP to 400 so one ultimate attack kills
    // Note: direct field access in tests is fine; data race acceptable in test code
    room = rm.GetRoom(room.ID)
    room.Players["host1"].HP = 400

    hub.Register(&Client{Conn: hostConn, RoomID: room.ID, PlayerID: "host1"})
    hub.Register(&Client{Conn: p2Conn, RoomID: room.ID, PlayerID: "player1"})
    time.Sleep(10 * time.Millisecond)

    handler := NewHandler(hub, rm)

    // Select ultimate attack on player1
    selectMsg := CombatClientMessage{
        Type: "select_attack",
        SelectAttack: &SelectAttackPayload{Tier: "ultimate"},
    }
    selectData, _ := json.Marshal(selectMsg)
    handler.handleSelectAttack(p2Conn, room.ID, "player1", selectData)
    time.Sleep(10 * time.Millisecond)

    // Complete attack with ultimate phrase
    completeMsg := CombatClientMessage{
        Type: "attack_complete",
        AttackComplete: &AttackCompletePayload{
            Tier:    "ultimate",
            Phrase:  "The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon",
            Correct: 98,
            Total:   98,
        },
    }
    completeData, _ := json.Marshal(completeMsg)
    handler.handleAttackComplete(p2Conn, room.ID, "player1", completeData)
    time.Sleep(10 * time.Millisecond)

    // Check p2's messages for battle_over
    foundBattleOver := false
    for _, msgBytes := range p2Conn.messages {
        var resp CombatServerMessage
        if err := json.Unmarshal(msgBytes, &resp); err != nil {
            continue
        }
        if resp.Type == "battle_over" {
            foundBattleOver = true
            if resp.BattleOver == nil {
                t.Fatal("expected battle_over payload")
            }
            if resp.BattleOver.Winner != "player1" {
                t.Errorf("expected winner 'player1', got '%s'", resp.BattleOver.Winner)
            }
            if resp.BattleOver.Reason != "opponent_defeated" {
                t.Errorf("expected reason 'opponent_defeated', got '%s'", resp.BattleOver.Reason)
            }
        }
    }
    if !foundBattleOver {
        t.Error("expected battle_over message to be sent to attacker")
    }
}
```

- [ ] **Step 5: Run Go tests**

Run: `cd server && go test ./...`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/internal/ws/handler_test.go
git commit -m "test: update handler tests for client-side phrases"
```

---

### Task 7: Combo visual feedback

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`
- Modify: `client/src/components/HealthBar.tsx`

- [ ] **Step 1: Add streak counter state and tracking**

In `client/src/app/room/[id]/page.tsx`, add state:

```typescript
const [comboStreak, setComboStreak] = useState(0)
const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null)
```

Add in `handleAttackComplete`, after the `sendMessage` call:

```typescript
setComboStreak(prev => prev + 1)
if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current)
comboTimeoutRef.current = setTimeout(() => setComboStreak(0), 5000)
```

Add streak display in the JSX, inside the `playing` block:

```tsx
{comboStreak > 1 && (
  <div
    key={comboStreak}
    className="text-center text-lg font-bold text-yellow-400 animate-pulse"
  >
    {comboStreak}x Combo!
  </div>
)}
```

Add cleanup in the useEffect return:

```typescript
if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current)
```

- [ ] **Step 2: Add CSS animation class**

In `client/src/app/room/[id]/page.tsx`, the `animate-pulse` class is a Tailwind utility that's already available. No additional CSS needed.

- [ ] **Step 3: Smooth HP bar transitions**

In `client/src/components/HealthBar.tsx`, add transition styling to the HP bar fill:

Replace the bar div to include transition:
```tsx
<div
  className="h-full rounded-full transition-all duration-500 ease-out"
  style={{
    width: `${Math.max(0, (hp / maxHp) * 100)}%`,
    backgroundColor: getBarColor(),
  }}
/>
```

Add the `getBarColor` helper:
```tsx
const getBarColor = () => {
  const ratio = hp / maxHp
  if (ratio > 0.6) return '#22c55e' // green-500
  if (ratio > 0.3) return '#eab308' // yellow-500
  return '#ef4444' // red-500
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 5: Run client tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add client/src/app/room/\[id\]/page.tsx client/src/components/HealthBar.tsx
git commit -m "feat: add combo streak counter and smooth HP transitions"
```

---

### Task 8: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run Go tests**

Run: `cd server && go test ./...`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript type check**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Run client tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 4: Manual verification checklist**

- [ ] Player sees phrase immediately after pressing 1-4 (no delay)
- [ ] Player can switch attacks mid-phrase by pressing a different number
- [ ] Attack completion sends tier, phrase, correct, and total
- [ ] Damage is calculated and applied correctly
- [ ] HP updates are broadcast to both players
- [ ] Battle ends when a player's HP reaches 0
- [ ] Game timeout still works correctly
- [ ] WPM and accuracy stats are correct in results
