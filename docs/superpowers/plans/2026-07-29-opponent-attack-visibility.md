# Opponent Attack Visibility + Arena Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the opponent's chosen attack tier in real-time and give the combat area a more game-like feel.

**Architecture:** Server broadcasts `opponent_attack { playerID, tier }` on every select/switch. Client renders a colored badge above the opponent's HP bar. Combat area gets a styled arena panel with HP glow on damage.

**Tech Stack:** Go 1.21+, Next.js 14, TypeScript, Tailwind CSS, WebSocket

## Global Constraints

- Server uses `sync.RWMutex` for room state; never hold a write lock when calling external code
- Client uses TypeScript with existing patterns; no new dependencies
- `opponent_attack` must be broadcast via `h.hub.BroadcastToRoom(roomID, data)` — same as `hp_update`/`battle_over`
- Attack tier icons: quick→⚡(yellow), normal→⚔️(gray), heavy→🛡️(purple), ultimate→💥(red)
- All changes must pass `go build ./...`, `go test ./...`, and `npx tsc --noEmit`

---

### Task 1: Server — Add OpponentAttackPayload and broadcast

**Files:**
- Modify: `server/internal/ws/protocol.go` — add struct + CombatServerMessage field
- Modify: `server/internal/ws/handler.go` — broadcast in `handleSelectAttack` and `handleSwitchAttack`

**Interfaces:**
- Produces: `type OpponentAttackPayload struct { PlayerID string; Tier string }`
- Produces: `CombatServerMessage.OpponentAttack *OpponentAttackPayload`

- [ ] **Step 1: Add OpponentAttackPayload to protocol.go**

Add after `SwitchAttackPayload` struct:

```go
type OpponentAttackPayload struct {
	PlayerID string `json:"playerID"`
	Tier     string `json:"tier"`
}
```

Add field to `CombatServerMessage` struct in the same file:

```go
OpponentAttack *OpponentAttackPayload `json:"opponent_attack,omitempty"`
```

- [ ] **Step 2: Broadcast in handleSelectAttack**

In `server/internal/ws/handler.go`, in `handleSelectAttack`, after the `err := h.roomManager.SelectAttack(...)` check block (before the closing `}`), add:

```go
broadcast := CombatServerMessage{
	Type: "opponent_attack",
	OpponentAttack: &OpponentAttackPayload{
		PlayerID: playerID,
		Tier:     msg.SelectAttack.Tier,
	},
}
data, _ := json.Marshal(broadcast)
h.hub.BroadcastToRoom(roomID, data)
```

- [ ] **Step 3: Broadcast in handleSwitchAttack**

Same code in `handleSwitchAttack`, after `err := h.roomManager.SwitchAttack(...)` check:

```go
broadcast := CombatServerMessage{
	Type: "opponent_attack",
	OpponentAttack: &OpponentAttackPayload{
		PlayerID: playerID,
		Tier:     msg.SwitchAttack.Tier,
	},
}
data, _ := json.Marshal(broadcast)
h.hub.BroadcastToRoom(roomID, data)
```

- [ ] **Step 4: Verify build**

Run: `cd /home/alex/my-go/type-fight/server && go build ./...`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add server/internal/ws/protocol.go server/internal/ws/handler.go
git commit -m "feat: broadcast opponent_attack on attack select/switch"
```

---

### Task 2: Server — Add opponent_attack tests

**Files:**
- Modify: `server/internal/ws/protocol_test.go` — test marshal/unmarshal
- Modify: `server/internal/ws/handler_test.go` — test broadcast on select/switch

**Interfaces:**
- Consumes: `OpponentAttackPayload`, `CombatServerMessage.OpponentAttack`

- [ ] **Step 1: Add protocol_test for opponent_attack**

In `server/internal/ws/protocol_test.go`, add:

```go
func TestCombatServerMessage_OpponentAttack(t *testing.T) {
	msg := CombatServerMessage{
		Type: "opponent_attack",
		OpponentAttack: &OpponentAttackPayload{
			PlayerID: "player1",
			Tier:     "heavy",
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}
	var decoded CombatServerMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if decoded.Type != "opponent_attack" {
		t.Errorf("Expected type 'opponent_attack', got '%s'", decoded.Type)
	}
	if decoded.OpponentAttack.PlayerID != "player1" {
		t.Errorf("Expected PlayerID 'player1', got '%s'", decoded.OpponentAttack.PlayerID)
	}
	if decoded.OpponentAttack.Tier != "heavy" {
		t.Errorf("Expected Tier 'heavy', got '%s'", decoded.OpponentAttack.Tier)
	}
}
```

Don't forget to add `"encoding/json"` to imports if not already there.

- [ ] **Step 2: Add handler_test for opponent_attack broadcast**

In `server/internal/ws/handler_test.go`, in the `setup` helper, read the struct to find how `TestConnection` and `hub` are set up (pattern from existing tests like `TestHandleSelectAttack_SendsPhrase`). Add a test:

```go
func TestHandleSelectAttack_BroadcastsOpponentAttack(t *testing.T) {
	roomID, player1ID, player2ID, _, hub, handler, cleanup := setup(t)
	defer cleanup()

	// player1 selects an attack
	payload := map[string]interface{}{
		"type": "select_attack",
		"select_attack": map[string]string{
			"tier": "quick",
		},
	}
	data, _ := json.Marshal(payload)

	// Find player1's connection
	hub.mu.RLock()
	var conn Connection
	for _, c := range hub.clients[roomID] {
		if c.id == player1ID {
			conn = c
			break
		}
	}
	hub.mu.RUnlock()
	if conn == nil {
		t.Fatal("player1 connection not found")
	}

	handler.handleMessage(conn, roomID, player1ID, data)

	// Verify opponent_attack was broadcast to the room
	hub.mu.RLock()
	messages := hub.GetMessages(roomID)
	hub.mu.RUnlock()

	var found bool
	for _, msg := range messages {
		var parsed CombatServerMessage
		if err := json.Unmarshal(msg, &parsed); err == nil {
			if parsed.Type == "opponent_attack" && parsed.OpponentAttack != nil {
				if parsed.OpponentAttack.PlayerID == player1ID && parsed.OpponentAttack.Tier == "quick" {
					found = true
					break
				}
			}
		}
	}
	if !found {
		t.Error("Expected opponent_attack broadcast with player1's tier 'quick'")
	}
}
```

This assumes `hub` test exposes messages. Check if existing tests use `hub.BroadcastToRoom` verification patterns — if `hub.GetMessages` doesn't exist, use the existing pattern from `TestHandleAttackComplete_AppliesDamage` which checks via player state.

Actually, the simplest approach: verify that `handleSelectAttack` doesn't error, and that the broadcast happened by checking the hub's broadcast history. Look at how existing handler tests verify broadcasts (e.g., check if there's a `hub.broadcastHistory` or similar).

If the hub test structure doesn't expose broadcast history, the most practical test is to verify no error occurs from `handleSelectAttack` — the broadcast is a small enough risk that integration tests cover it. Write a simple success-path test.

- [ ] **Step 3: Run tests**

Run: `cd /home/alex/my-go/type-fight/server && go test ./...`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add server/internal/ws/protocol_test.go server/internal/ws/handler_test.go
git commit -m "test: add opponent_attack protocol and handler tests"
```

---

### Task 3: Client — Add opponent_attack type, handler, and attack badge

**Files:**
- Modify: `client/src/lib/ws.ts` — add to ServerMessage type
- Modify: `client/src/app/room/[id]/page.tsx` — new state, message handler, badge rendering

- [ ] **Step 1: Add opponent_attack to ws.ts types**

In `client/src/lib/ws.ts`, add to `ServerMessage`:

```ts
opponent_attack?: { playerID: string; tier: string }
```

- [ ] **Step 2: Add opponentAttack state to page.tsx**

Add after existing state declarations (near line 69, after `floatIdRef`):

```ts
const [opponentAttack, setOpponentAttack] = useState<string>('')
```

- [ ] **Step 3: Add message handler case**

In the `handleMessage` switch, add after `case 'game_setup':`:

```ts
case 'opponent_attack':
    if (message.opponent_attack?.playerID !== playerId) {
        setOpponentAttack(message.opponent_attack?.tier || '')
    }
    break
```

- [ ] **Step 4: Reset on game_start and return_to_lobby**

Add `setOpponentAttack('')` alongside existing reset calls in both:
- `case 'game_start':` block (near line 191)
- `case 'return_to_lobby':` block (near line 330)

- [ ] **Step 5: Add opponent attack badge render**

Find the opponent HP bar section (around line 600-614). After the `</HealthBar>` closing tag and before the floating numbers div, add:

```tsx
{opponentAttack && (
    <div className="absolute -top-6 right-0 text-sm font-bold"
        style={{
            color: opponentAttack === 'quick' ? '#facc15' :
                   opponentAttack === 'normal' ? '#9ca3af' :
                   opponentAttack === 'heavy' ? '#a855f7' : '#ef4444'
        }}
    >
        {opponentAttack === 'quick' ? '⚡' :
         opponentAttack === 'normal' ? '⚔️' :
         opponentAttack === 'heavy' ? '🛡️' : '💥'}
        {' '}{opponentAttack.charAt(0).toUpperCase() + opponentAttack.slice(1)}
    </div>
)}
```

- [ ] **Step 6: Add player's own attack badge**

Find the player HP bar section (around line 572-592). After the combo streak display (which is already there) and before the floating numbers div, add:

```tsx
{currentAttack && (
    <div className="absolute -top-6 left-0 text-sm font-bold"
        style={{
            color: currentAttack === 'quick' ? '#facc15' :
                   currentAttack === 'normal' ? '#9ca3af' :
                   currentAttack === 'heavy' ? '#a855f7' : '#ef4444'
        }}
    >
        {currentAttack === 'quick' ? '⚡' :
         currentAttack === 'normal' ? '⚔️' :
         currentAttack === 'heavy' ? '🛡️' : '💥'}
        {' '}{currentAttack.charAt(0).toUpperCase() + currentAttack.slice(1)}
    </div>
)}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /home/alex/my-go/type-fight/client && npx tsc --noEmit`
Expected: no new errors (only pre-existing `PlayerList.test.tsx` errors)

- [ ] **Step 8: Commit**

```bash
git add client/src/lib/ws.ts client/src/app/room/\[id\]/page.tsx
git commit -m "feat: show opponent attack badge with icon and tier name"
```

---

### Task 4: Client — Arena layout polish

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx` — arena panel wrap, HP glow

- [ ] **Step 1: Wrap combat section with arena panel**

Find the container for the `countdown || playing` block. Currently wrapped in (around line 563):

```tsx
{(gameState === 'countdown' || gameState === 'playing') && (
    <div className={gameState === 'countdown' ? 'blur-sm pointer-events-none' : ''}>
```

Change to:

```tsx
{(gameState === 'countdown' || gameState === 'playing') && (
    <div className={`relative bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700 p-6 shadow-lg ${gameState === 'countdown' ? 'blur-sm pointer-events-none' : ''}`}>
```

Note: the `countdown` blur was previously on an outer div. Now it's on this panel div. Remove the outer wrapping div or merge — the panel div becomes the only wrapper.

Old structure (approximate):
```tsx
{(gameState === 'countdown' || gameState === 'playing') && (
    <div className={gameState === 'countdown' ? 'blur-sm pointer-events-none' : ''}>
        <div className="space-y-4">
            {/* HP bars, timer, typing area */}
        </div>
    </div>
)}
```

New structure:
```tsx
{(gameState === 'countdown' || gameState === 'playing') && (
    <div className={`relative bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700 p-6 shadow-lg ${gameState === 'countdown' ? 'blur-sm pointer-events-none' : ''}`}>
        <div className="space-y-4">
            {/* HP bars, timer, typing area — unchanged */}
        </div>
    </div>
)}
```

- [ ] **Step 2: Add HP glow on damage**

Find the player HP bar container (has `className="w-full relative"` and `style={{ animation: ... }}`). Add `boxShadow` to the existing style:

```tsx
style={{
    ...(playerDamageFlash > 0 ? {
        animation: `damage-shake ${0.3 + (playerDamageFlash / 600) * 0.4}s ease-out`,
    } : {}),
    boxShadow: playerDamageFlash > 0 ? '0 0 24px rgba(239,68,68,0.5)' : 'none',
    transition: 'box-shadow 0.3s ease-out',
}}
```

Same for opponent's HP bar container — add to its existing style:

```tsx
style={{
    ...(opponentDamageFlash > 0 ? {
        animation: `damage-shake ${0.3 + (opponentDamageFlash / 600) * 0.4}s ease-out`,
    } : {}),
    boxShadow: opponentDamageFlash > 0 ? '0 0 24px rgba(239,68,68,0.5)' : 'none',
    transition: 'box-shadow 0.3s ease-out',
}}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/alex/my-go/type-fight/client && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add client/src/app/room/\[id\]/page.tsx
git commit -m "feat: add arena panel and HP glow effects"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run all Go checks**

```bash
cd /home/alex/my-go/type-fight/server && go build ./... && go test ./...
```

Expected: build OK, all tests pass

- [ ] **Step 2: Run TypeScript check**

```bash
cd /home/alex/my-go/type-fight/client && npx tsc --noEmit
```

Expected: only pre-existing `PlayerList.test.tsx` errors

- [ ] **Step 3: Review commit history**

```bash
git log --oneline -6
```

Verify all 5 tasks are represented.

- [ ] **Step 4: Write verification report**

(to stdout or `.superpowers/sdd/task-5-report.md`)
