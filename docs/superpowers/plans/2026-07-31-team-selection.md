# Team Selection, Loadout Enforcement & Static Battleground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each player pick exactly 4 of the 7 characters (on the home page and in the room lobby), enforce that team as their battle loadout on both client and server, show both players' real teams on the battlefield, and remove the parallax pan so the battleground is static (camera zoom on attack-select stays as the only motion).

**Architecture:** The `ready` message carries the player's team; the `start_game` message carries the host's team (the host never sends `ready`). The server stores `Team` on `PlayerState`, validates exactly-4-distinct on ready/start, rejects any attack tier not in the player's team, and includes `team` in every `PlayerInfo` payload so both teams render on the battlefield. On the client, a new `TeamPicker` (used on home + lobby) persists drafts (0–4 tiers) via `team.ts`; `getTeam()` no longer auto-fills a default; Ready/Start buttons are gated on 4/4; `AttackSelector` filters to the team; `ParallaxScene` drops its rAF pan loop and 2-copy tiling and renders each layer once (static), leaving `BattleCamera` zoom as the only motion.

**Tech Stack:** Next.js 15 / React 19 / TypeScript (client), Go 1.22 + gorilla/websocket (server), Tailwind v4, Vitest + Testing Library (client tests), Go stdlib `testing` (server tests).

## Global Constraints

- Tier names are exactly: `'grunt' | 'archer' | 'paladin' | 'wizard' | 'cleric' | 'priest' | 'saint'`.
- A **playable team** is exactly 4 distinct tiers. A **draft** is 0–4 distinct valid tiers (persisted, not playable).
- `ready` and `start_game` messages carry the sender's team; the server rejects either without a valid team.
- Every `PlayerInfo` payload (`player_list`, `game_start`, `player_joined`, `player_left`) includes `team`.
- The server rejects `select_attack` / `switch_attack` / `attack_complete` tiers not in the player's team.
- The battleground is fully static; the only motion is `BattleCamera`'s `scale(1.12)` zoom on attack select.
- Do not add code comments (project convention).
- Verify client changes with `cd client && npm run lint && npm test && npm run build`; server with `cd server && go test ./...`.

---

### Task 1: `IsValidTeam` server helper

**Files:**
- Modify: `server/internal/game/room.go` (add helpers near `generateID` at the bottom)
- Test: `server/internal/game/room_test.go`

**Interfaces:**
- Produces: `func IsValidTeam(team []string) bool` — true iff exactly 4 tiers, all distinct, every tier known to the engine (`GetAttackDef(tier).MinWords > 0`). `func containsTier(team []string, tier string) bool` — true iff `team` includes `tier`.

- [ ] **Step 1: Write the failing test**

Append to `server/internal/game/room_test.go`:

```go
func TestIsValidTeam(t *testing.T) {
	valid := []string{"grunt", "archer", "paladin", "cleric"}
	if !IsValidTeam(valid) {
		t.Errorf("expected %v to be a valid team", valid)
	}

	invalid := [][]string{
		{"grunt", "archer", "paladin"},
		{"grunt", "grunt", "grunt", "grunt"},
		{"grunt", "archer", "paladin", "nope"},
		{"grunt", "archer", "paladin", "cleric", "wizard"},
		{},
	}
	for _, team := range invalid {
		if IsValidTeam(team) {
			t.Errorf("expected %v to be invalid", team)
		}
	}
}

func TestContainsTier(t *testing.T) {
	team := []string{"grunt", "archer", "paladin", "cleric"}
	if !containsTier(team, "grunt") {
		t.Error("expected containsTier to find grunt")
	}
	if containsTier(team, "wizard") {
		t.Error("expected containsTier to reject wizard")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test ./internal/game/ -run 'TestIsValidTeam|TestContainsTier'`
Expected: FAIL with `undefined: IsValidTeam` (does not compile).

- [ ] **Step 3: Write the helpers**

Append to the bottom of `server/internal/game/room.go`:

```go
func IsValidTeam(team []string) bool {
	if len(team) != 4 {
		return false
	}
	seen := make(map[string]bool)
	for _, tier := range team {
		def := GetAttackDef(tier)
		if def.MinWords == 0 || seen[tier] {
			return false
		}
		seen[tier] = true
	}
	return true
}

func containsTier(team []string, tier string) bool {
	for _, t := range team {
		if t == tier {
			return true
		}
	}
	return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test ./internal/game/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/game/room.go server/internal/game/room_test.go
git commit -m "feat: add IsValidTeam and containsTier helpers"
```

---

### Task 2: Server protocol structs carry `team`

**Files:**
- Modify: `server/internal/ws/protocol.go`
- Test: `server/internal/ws/protocol_test.go`

**Interfaces:**
- Produces: `ClientMessage.Team []string` (json `team,omitempty`); `PlayerInfo.Team []string` (json `team,omitempty`). Later tasks rely on these being present so `handleReady`/`handleStartGame` can pass `msg.Team` and every player broadcast can carry teams.

- [ ] **Step 1: Write the failing tests**

Append to `server/internal/ws/protocol_test.go`:

```go
func TestClientMessage_ReadyWithTeam(t *testing.T) {
	msg := ClientMessage{
		Type: "ready",
		Team: []string{"grunt", "archer", "paladin", "cleric"},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	var decoded ClientMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if decoded.Type != "ready" {
		t.Errorf("got type %s, want 'ready'", decoded.Type)
	}
	if len(decoded.Team) != 4 || decoded.Team[0] != "grunt" {
		t.Errorf("got team %v, want 4 tiers starting with grunt", decoded.Team)
	}
}

func TestPlayerInfo_MarshalIncludesTeam(t *testing.T) {
	msg := ServerMessage{
		Type: "player_list",
		Players: []PlayerInfo{
			{ID: "p1", Name: "Alice", Team: []string{"grunt", "archer", "paladin", "cleric"}},
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	players, ok := result["players"].([]interface{})
	if !ok || len(players) != 1 {
		t.Fatalf("expected one player, got %v", result["players"])
	}
	team, ok := players[0].(map[string]interface{})["team"].([]interface{})
	if !ok || len(team) != 4 {
		t.Errorf("expected player team with 4 entries, got %v", players[0])
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && go test ./internal/ws/ -run 'TestClientMessage_ReadyWithTeam|TestPlayerInfo_MarshalIncludesTeam'`
Expected: FAIL (`undefined: msg.Team`).

- [ ] **Step 3: Add the fields**

In `server/internal/ws/protocol.go`:

```go
type ClientMessage struct {
	Type       string `json:"type"`
	PlayerName string `json:"player_name,omitempty"`
	Char       string `json:"char,omitempty"`
	Position   int    `json:"position,omitempty"`
	Team       []string `json:"team,omitempty"`
}
```

```go
type PlayerInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Team []string `json:"team,omitempty"`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && go test ./internal/ws/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/ws/protocol.go server/internal/ws/protocol_test.go
git commit -m "feat: carry team in client messages and player info"
```

---

### Task 3: Server stores team at ready

**Files:**
- Modify: `server/internal/game/room.go:11-30` (`PlayerState`), `server/internal/game/room.go:363-391` (`SetPlayerReady`)
- Modify: `server/internal/ws/handler.go:33-34` and `:97-102` (`handleReady` wiring)
- Test: `server/internal/game/room_test.go`

**Interfaces:**
- Consumes: `IsValidTeam` (Task 1), `ClientMessage.Team` (Task 2).
- Produces: `PlayerState.Team []string`; `func (rm *RoomManager) SetPlayerReady(roomID, playerID string, team []string) (bool, error)` — returns `(false, "invalid team")` and does **not** mark ready when the team is invalid; stores `player.Team` and returns `allReady` when valid.

- [ ] **Step 1: Write the failing tests**

Append to `server/internal/game/room_test.go`:

```go
func TestSetPlayerReady_SetsTeamAndReady(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host1", "Host")
	rm.JoinRoom(room.ID, "player1", "Player 1")
	team := []string{"grunt", "archer", "paladin", "cleric"}
	allReady, err := rm.SetPlayerReady(room.ID, "player1", team)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if allReady {
		t.Error("expected not all ready (host not ready)")
	}
	room = rm.GetRoom(room.ID)
	if !room.Players["player1"].Ready {
		t.Error("expected player to be ready")
	}
	if len(room.Players["player1"].Team) != 4 || room.Players["player1"].Team[0] != "grunt" {
		t.Errorf("expected team stored, got %v", room.Players["player1"].Team)
	}
}

func TestSetPlayerReady_RejectsInvalidTeam(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host1", "Host")
	rm.JoinRoom(room.ID, "player1", "Player 1")
	invalidTeams := [][]string{
		{"grunt", "archer", "paladin"},
		{"grunt", "grunt", "grunt", "grunt"},
		{"grunt", "archer", "paladin", "nope"},
	}
	for _, team := range invalidTeams {
		_, err := rm.SetPlayerReady(room.ID, "player1", team)
		if err == nil {
			t.Errorf("expected error for team %v", team)
		}
		room = rm.GetRoom(room.ID)
		if room.Players["player1"].Ready {
			t.Errorf("expected player not ready after invalid team %v", team)
		}
	}
}

func TestSetPlayerReady_AllReady(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host1", "Host")
	rm.JoinRoom(room.ID, "player1", "Player 1")
	team := []string{"grunt", "archer", "paladin", "cleric"}
	if _, err := rm.SetPlayerReady(room.ID, "host1", team); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	allReady, err := rm.SetPlayerReady(room.ID, "player1", team)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !allReady {
		t.Error("expected all ready")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && go test ./internal/game/ -run TestSetPlayerReady`
Expected: FAIL (does not compile — `SetPlayerReady` has wrong arity, `PlayerState.Team` missing).

- [ ] **Step 3: Add `Team` to `PlayerState` and change `SetPlayerReady`**

In `server/internal/game/room.go`, add `Team []string` to `PlayerState`:

```go
type PlayerState struct {
	ID                 string
	Name               string
	Team               []string
	Position           int
	...
}
```

Replace the whole `SetPlayerReady` function (currently `func (rm *RoomManager) SetPlayerReady(roomID, playerID string) (bool, error)`):

```go
func (rm *RoomManager) SetPlayerReady(roomID, playerID string, team []string) (bool, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return false, fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	player, exists := room.Players[playerID]
	if !exists {
		return false, fmt.Errorf("player not in room")
	}

	if !IsValidTeam(team) {
		return false, fmt.Errorf("invalid team")
	}
	player.Team = team
	player.Ready = true

	allReady := true
	for _, p := range room.Players {
		if !p.Ready {
			allReady = false
			break
		}
	}

	return allReady, nil
}
```

- [ ] **Step 4: Update the handler to pass the team**

In `server/internal/ws/handler.go`:

```go
	case "ready":
		h.handleReady(conn, roomID, playerID, msg)
```

```go
func (h *Handler) handleReady(conn Connection, roomID, playerID string, msg ClientMessage) {
	allReady, err := h.roomManager.SetPlayerReady(roomID, playerID, msg.Team)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && go test ./...`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/internal/game/room.go server/internal/game/room_test.go server/internal/ws/handler.go
git commit -m "feat: store team on player at ready and validate it"
```

---

### Task 4: Enforce team as the attack loadout (server)

**Files:**
- Modify: `server/internal/game/room.go:476-495` (`SelectAttack`), `:507-596` (`CompleteAttack`), `:598-617` (`SwitchAttack`)
- Modify: `server/internal/game/room_test.go:7-14` (`setupTestRoom`)
- Test: `server/internal/game/room_test.go`

**Interfaces:**
- Consumes: `containsTier` (Task 1). `setupTestRoom` now sets both players' `Team` directly before `StartGame`.
- Produces: `SelectAttack`/`SwitchAttack` return `"attack tier not in your team"` for out-of-team tiers; `CompleteAttack` returns the same error for a tier not in the team.

- [ ] **Step 1: Update `setupTestRoom` so existing room tests keep passing**

Replace the `setupTestRoom` function in `server/internal/game/room_test.go`:

```go
func setupTestRoom() (*RoomManager, string, string) {
	rm := NewRoomManager()
	room := rm.CreateRoom("player1-id", "Player1")
	rm.JoinRoom(room.ID, "player1-id", "Player1")
	rm.JoinRoom(room.ID, "player2-id", "Player2")
	room = rm.GetRoom(room.ID)
	team := []string{"grunt", "archer", "paladin", "cleric"}
	room.Players["player1-id"].Team = team
	room.Players["player2-id"].Team = team
	rm.StartGame(room.ID, "player1-id")
	return rm, room.ID, "player2-id"
}
```

(`StartGame` still takes 2 args in this task; it changes in Task 5.)

- [ ] **Step 2: Write the failing tests**

Append to `server/internal/game/room_test.go`:

```go
func TestSelectAttack_RejectsTierNotInTeam(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	var playerID string
	for id := range room.Players {
		playerID = id
		break
	}
	err := rm.SelectAttack(playerID, "wizard")
	if err == nil {
		t.Error("expected error for tier not in team")
	}
	room = rm.GetRoom(roomID)
	if room.Players[playerID].CurrentAttack != "" {
		t.Errorf("expected no active attack, got %s", room.Players[playerID].CurrentAttack)
	}
}

func TestSwitchAttack_RejectsTierNotInTeam(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	var playerID string
	for id := range room.Players {
		playerID = id
		break
	}
	rm.SelectAttack(playerID, "grunt")
	err := rm.SwitchAttack(playerID, "wizard")
	if err == nil {
		t.Error("expected error for tier not in team")
	}
	room = rm.GetRoom(roomID)
	if room.Players[playerID].CurrentAttack != "grunt" {
		t.Errorf("expected attack to remain 'grunt', got %s", room.Players[playerID].CurrentAttack)
	}
}

func TestCompleteAttack_RejectsTierNotInTeam(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	room.Players[player1ID].CurrentAttack = "wizard"
	err := rm.CompleteAttack(player1ID, "wizard", "The ancient civilization discovered forgotten secrets", 100, 100)
	if err == nil {
		t.Error("expected error for tier not in team")
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd server && go test ./internal/game/ -run 'TestSelectAttack_RejectsTierNotInTeam|TestSwitchAttack_RejectsTierNotInTeam|TestCompleteAttack_RejectsTierNotInTeam'`
Expected: FAIL — no error returned for out-of-team tiers.

- [ ] **Step 4: Add team checks to the three attack functions**

In `SelectAttack`, replace the player-lookup section so it rejects out-of-team tiers:

```go
	for _, room := range rm.rooms {
		room.mu.Lock()
		player, exists := room.Players[playerID]
		if !exists {
			room.mu.Unlock()
			continue
		}
		if !containsTier(player.Team, tier) {
			room.mu.Unlock()
			return fmt.Errorf("attack tier not in your team")
		}
		player.CurrentAttack = tier
		room.mu.Unlock()
		return nil
	}
	return fmt.Errorf("player not found")
```

In `CompleteAttack`, add the team check right after the `CurrentAttack != tier` mismatch check:

```go
		if attacker.CurrentAttack != tier {
			room.mu.Unlock()
			return nil, fmt.Errorf("attack tier mismatch")
		}
		if !containsTier(attacker.Team, tier) {
			room.mu.Unlock()
			return nil, fmt.Errorf("attack tier not in your team")
		}
```

In `SwitchAttack`, replace the player-lookup section the same way as `SelectAttack`:

```go
	for _, room := range rm.rooms {
		room.mu.Lock()
		player, exists := room.Players[playerID]
		if !exists {
			room.mu.Unlock()
			continue
		}
		if !containsTier(player.Team, newTier) {
			room.mu.Unlock()
			return fmt.Errorf("attack tier not in your team")
		}
		player.CurrentAttack = newTier
		room.mu.Unlock()
		return nil
	}
	return fmt.Errorf("player not found")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && go test ./...`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/internal/game/room.go server/internal/game/room_test.go
git commit -m "feat: reject attack tiers outside the player's team"
```

---

### Task 5: `StartGame` requires teams and accepts the host team

**Files:**
- Modify: `server/internal/game/room.go:162-192` (`StartGame`)
- Modify: `server/internal/game/room_test.go:12` (`setupTestRoom` call)
- Modify: `server/internal/ws/handler.go:118` (auto-start call in `handleReady`), `:220` (`handleStartGame` call)
- Modify: `server/internal/ws/handler_test.go` (9 `StartGame` call sites + `TestHandleStartGame` runtime fix)
- Test: `server/internal/game/room_test.go`

**Interfaces:**
- Consumes: `IsValidTeam` (Task 1).
- Produces: `func (rm *RoomManager) StartGame(roomID, playerID string, hostTeam []string) error` — if `len(hostTeam) > 0`, validates and stores it on the host; then requires every player to have a valid team (`"all players must pick a team"`); then starts as before. The `handleReady` auto-start path passes `nil` (the host already readied with a team); `handleStartGame` still passes `nil` until Task 6 wires `msg.Team`.

- [ ] **Step 1: Write the failing tests**

Append to `server/internal/game/room_test.go`:

```go
func TestStartGame_RejectsWithoutTeams(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host1", "Host")
	rm.JoinRoom(room.ID, "host1", "Host")
	rm.JoinRoom(room.ID, "player1", "Player 1")
	err := rm.StartGame(room.ID, "host1", nil)
	if err == nil {
		t.Error("expected error when no player has a team")
	}
	room = rm.GetRoom(room.ID)
	if room.Status == "playing" {
		t.Error("expected game not to start")
	}
}

func TestStartGame_StoresHostTeam(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host1", "Host")
	rm.JoinRoom(room.ID, "host1", "Host")
	rm.JoinRoom(room.ID, "player1", "Player 1")
	hostTeam := []string{"grunt", "archer", "paladin", "cleric"}
	room = rm.GetRoom(room.ID)
	room.Players["player1"].Team = hostTeam
	err := rm.StartGame(room.ID, "host1", hostTeam)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	room = rm.GetRoom(room.ID)
	if len(room.Players["host1"].Team) != 4 {
		t.Errorf("expected host team stored, got %v", room.Players["host1"].Team)
	}
	if room.Status != "playing" {
		t.Error("expected game to start")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && go test ./internal/game/ -run TestStartGame`
Expected: FAIL (does not compile — `StartGame` has wrong arity).

- [ ] **Step 3: Change `StartGame`**

Replace the signature and add validation in `server/internal/game/room.go` (the beginning of `StartGame`):

```go
func (rm *RoomManager) StartGame(roomID, playerID string, hostTeam []string) error {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if room.HostID != playerID {
		return fmt.Errorf("only host can start the game")
	}

	if len(room.Players) < 2 {
		return fmt.Errorf("need at least 2 players to start")
	}

	if len(hostTeam) > 0 {
		if !IsValidTeam(hostTeam) {
			return fmt.Errorf("invalid team")
		}
		host := room.Players[room.HostID]
		host.Team = hostTeam
	}

	for _, p := range room.Players {
		if !IsValidTeam(p.Team) {
			return fmt.Errorf("all players must pick a team")
		}
	}

	room.Status = "playing"
	room.Text = GetRandomText()
	room.GameStart = time.Now()
	room.BattleStartTime = time.Now()

	for _, p := range room.Players {
		p.StartTime = room.GameStart
	}

	return nil
}
```

- [ ] **Step 4: Update all call sites**

In `server/internal/game/room_test.go` (`setupTestRoom`), change the `StartGame` call to pass `nil` (teams are set directly above it):

```go
	rm.StartGame(room.ID, "player1-id", nil)
```

In `server/internal/ws/handler.go`, both call sites get the third argument:

```go
			err := h.roomManager.StartGame(roomID, playerID, nil)
```

```go
	err := h.roomManager.StartGame(roomID, playerID, nil)
```

In `server/internal/ws/handler_test.go`, add this helper near `TestConnection`:

```go
func setTestTeams(rm *game.RoomManager, roomID string) {
	room := rm.GetRoom(roomID)
	team := []string{"grunt", "archer", "paladin", "cleric"}
	for _, p := range room.Players {
		p.Team = team
	}
}
```

Then replace **each of the 9** `rm.StartGame(room.ID, "host1")` call sites in `handler_test.go` (functions: `TestHandleKeystroke`, `TestHandleKeystrokePlayerFinished`, `TestHandleSelectAttack_StoresAttack`, `TestHandleAttackComplete_AppliesDamage`, `TestHandleSwitchAttack_UpdatesTier`, `TestHandleSelectAttack_BroadcastsOpponentAttack`, `TestHandleSwitchAttack_BroadcastsOpponentAttack`, `TestHandleAttackComplete_LethalSendsBattleOver`, `TestHandleKeystrokePlayerNotFinished`) with:

```go
	setTestTeams(rm, room.ID)
	err = rm.StartGame(room.ID, "host1", nil)
```

- [ ] **Step 5: Fix `TestHandleStartGame_SendsGameSetupWithBattleground` at runtime**

The game now refuses to start without teams. In that test, after both joins (the block ending with `handler.HandleMessage(connJoiner, room.ID, "player2", joinerJoin)` / `time.Sleep(10*time.Millisecond)`), set teams directly before sending `start_game`:

```go
	setTestTeams(rm, room.ID)

	startData, _ := json.Marshal(ClientMessage{Type: "start_game"})
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && go test ./...`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/internal/game/room.go server/internal/game/room_test.go server/internal/ws/handler.go server/internal/ws/handler_test.go
git commit -m "feat: require teams to start the game"
```

---

### Task 6: Handler wiring — start carries host team, all player info includes teams

**Files:**
- Modify: `server/internal/ws/handler.go` (`handleStartGame` at :219, `handleJoin` player lists at :69-95, `handleReady` game_start players at :126-132, `handlePlayAgain` player list at :199-214, `HandleDisconnect` at :518-521)
- Test: `server/internal/ws/handler_test.go`

**Interfaces:**
- Consumes: `StartGame(roomID, playerID, hostTeam)` (Task 5), `ClientMessage.Team` + `PlayerInfo.Team` (Task 2).
- Produces: `handleStartGame` passes `msg.Team`; every `PlayerInfo` built in the handlers includes `Team: p.Team`; `HandleDisconnect` builds its `player_left` players from `room.Players` (so teams survive).

- [ ] **Step 1: Write the failing tests**

Append to `server/internal/ws/handler_test.go`:

```go
func TestHandleReady_SetsTeam(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")
	handler := NewHandler(hub, rm)

	joinMsg, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Player 1"})
	handler.HandleMessage(conn, room.ID, "player1", joinMsg)
	time.Sleep(10 * time.Millisecond)

	team := []string{"grunt", "archer", "paladin", "cleric"}
	readyData, _ := json.Marshal(ClientMessage{Type: "ready", Team: team})
	handler.HandleMessage(conn, room.ID, "player1", readyData)
	time.Sleep(10 * time.Millisecond)

	room = rm.GetRoom(room.ID)
	if !room.Players["player1"].Ready {
		t.Error("expected player1 to be ready")
	}
	if len(room.Players["player1"].Team) != 4 || room.Players["player1"].Team[0] != "grunt" {
		t.Errorf("expected team stored, got %v", room.Players["player1"].Team)
	}

	foundReady := false
	for _, raw := range conn.messages {
		var resp ServerMessage
		if err := json.Unmarshal(raw, &resp); err != nil {
			continue
		}
		if resp.Type == "player_ready" && resp.ReadyPlayerID == "player1" {
			foundReady = true
		}
	}
	if !foundReady {
		t.Error("expected player_ready broadcast")
	}
}

func TestHandleReady_WithoutTeam_SendsError(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")
	handler := NewHandler(hub, rm)

	joinMsg, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Player 1"})
	handler.HandleMessage(conn, room.ID, "player1", joinMsg)
	time.Sleep(10 * time.Millisecond)

	readyData, _ := json.Marshal(ClientMessage{Type: "ready"})
	handler.HandleMessage(conn, room.ID, "player1", readyData)
	time.Sleep(10 * time.Millisecond)

	room = rm.GetRoom(room.ID)
	if room.Players["player1"].Ready {
		t.Error("expected player1 to NOT be ready without a team")
	}

	foundError := false
	for _, raw := range conn.messages {
		var resp ServerMessage
		if err := json.Unmarshal(raw, &resp); err != nil {
			continue
		}
		if resp.Type == "error" {
			foundError = true
		}
	}
	if !foundError {
		t.Error("expected error message when ready without team")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && go test ./internal/ws/ -run 'TestHandleReady'`
Expected: FAIL — ready without team does not error yet (because `handleStartGame`/`SetPlayerReady` wiring from Task 3 already passes `msg.Team`, so the ready-without-team case should error; if it passes, verify the team is not stored). The real assertion to make fail first is that `game_start` players lack teams — covered in step 5.

- [ ] **Step 3: Wire the host team into `handleStartGame`**

In `server/internal/ws/handler.go`:

```go
func (h *Handler) handleStartGame(conn Connection, roomID, playerID string) {
	err := h.roomManager.StartGame(roomID, playerID, msg.Team)
```

Change the signature to accept the message and update the switch case:

```go
	case "start_game":
		h.handleStartGame(conn, roomID, playerID, msg)
```

```go
func (h *Handler) handleStartGame(conn Connection, roomID, playerID string, msg ClientMessage) {
	err := h.roomManager.StartGame(roomID, playerID, msg.Team)
```

- [ ] **Step 4: Add `Team` to every `PlayerInfo` construction**

In `handleJoin`, the `player_list` loop becomes:

```go
	players := make([]PlayerInfo, 0)
	for _, p := range room.Players {
		players = append(players, PlayerInfo{
			ID:   p.ID,
			Name: p.Name,
			Team: p.Team,
		})
	}
```

The `player_joined` broadcast in `handleJoin` becomes:

```go
	broadcastMsg := ServerMessage{
		Type: "player_joined",
		Player: &PlayerInfo{
			ID:   playerID,
			Name: msg.PlayerName,
			Team: room.Players[playerID].Team,
		},
	}
```

In `handleReady`, the `game_start` players loop becomes:

```go
			players := make([]PlayerInfo, 0)
			for _, p := range room.Players {
				players = append(players, PlayerInfo{
					ID:   p.ID,
					Name: p.Name,
					Team: p.Team,
				})
			}
```

In `handlePlayAgain`, the `return_to_lobby` `player_list` loop becomes:

```go
			players := make([]PlayerInfo, 0)
			for _, p := range room.Players {
				players = append(players, PlayerInfo{
					ID:   p.ID,
					Name: p.Name,
					Team: p.Team,
				})
			}
```

In `HandleDisconnect`, the `player_left` players loop becomes (build from `room.Players` so the team survives the disconnect):

```go
	players := make([]PlayerInfo, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, PlayerInfo{ID: p.ID, Name: p.Name, Team: p.Team})
	}
```

- [ ] **Step 5: Update `TestHandleStartGame_SendsGameSetupWithBattleground` to the real flow**

Replace the whole test with the realistic flow: guest readies with a team, host starts carrying their team, and the `game_start` players include teams:

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

	hostJoin, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Host Player"})
	handler.HandleMessage(connHost, room.ID, "host1", hostJoin)
	time.Sleep(10 * time.Millisecond)

	joinerJoin, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Joiner"})
	handler.HandleMessage(connJoiner, room.ID, "player2", joinerJoin)
	time.Sleep(10 * time.Millisecond)

	team := []string{"grunt", "archer", "paladin", "cleric"}
	readyData, _ := json.Marshal(ClientMessage{Type: "ready", Team: team})
	handler.HandleMessage(connJoiner, room.ID, "player2", readyData)
	time.Sleep(10 * time.Millisecond)

	startData, _ := json.Marshal(ClientMessage{Type: "start_game", Team: team})
	handler.HandleMessage(connHost, room.ID, "host1", startData)
	time.Sleep(20 * time.Millisecond)

	foundSetup := false
	foundTeams := false
	for _, raw := range connHost.messages {
		var resp ServerMessage
		if err := json.Unmarshal(raw, &resp); err != nil {
			continue
		}
		if resp.Type == "game_setup" && resp.Battleground != "" {
			foundSetup = true
		}
		if resp.Type == "game_start" {
			for _, p := range resp.Players {
				if len(p.Team) == 4 {
					foundTeams = true
				}
			}
		}
	}
	if !foundSetup {
		t.Error("expected a game_setup message carrying a battleground id")
	}
	if !foundTeams {
		t.Error("expected game_start players to include teams")
	}
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && go test ./...`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/internal/ws/handler.go server/internal/ws/handler_test.go
git commit -m "feat: send host team at start and include teams in player info"
```

---

### Task 7: Update integration tests for the team flow

**Files:**
- Modify: `server/internal/integration/integration_test.go`

**Interfaces:**
- Consumes: `ws.ClientMessage{Type: "ready", Team: ...}` and `ws.ClientMessage{Type: "start_game", Team: ...}` (Tasks 2-6).

- [ ] **Step 1: Make the guest ready with a team in each flow test**

In **each** of the 5 tests (`TestFullGameFlow_BothPlayersFinish`, `TestProgressBroadcastToOpponent`, `TestPlayerFinishedNotification`, `TestTimerContinuesAfterNotification`, `TestTimeoutGameEnd`), the join block ends with the guest joined and `hostClient.waitFor(t, "player_joined", 2*time.Second)`. Directly after that block, insert a guest ready with a team:

For `TestFullGameFlow_BothPlayersFinish` (guest conn is `secondConn`, client `secondClient`):

```go
	// Guest readies with a team, host starts with their team
	team := []string{"grunt", "archer", "paladin", "cleric"}
	sendMsg(t, secondConn, ws.ClientMessage{Type: "ready", Team: team})
	secondClient.waitFor(t, "player_ready", 2*time.Second)
```

For the other 4 tests (guest conn is `p2Conn`, client `p2Client`):

```go
	// Guest readies with a team, host starts with their team
	team := []string{"grunt", "archer", "paladin", "cleric"}
	sendMsg(t, p2Conn, ws.ClientMessage{Type: "ready", Team: team})
	p2Client.waitFor(t, "player_ready", 2*time.Second)
```

- [ ] **Step 2: Make the host carry their team in `start_game`**

In the same 5 tests, replace `sendMsg(t, hostConn, ws.ClientMessage{Type: "start_game"})` with:

```go
	sendMsg(t, hostConn, ws.ClientMessage{Type: "start_game", Team: team})
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd server && go test ./...`
Expected: PASS (the timeout test takes ~35s).

- [ ] **Step 4: Commit**

```bash
git add server/internal/integration/integration_test.go
git commit -m "test: integration flows send teams on ready and start"
```

---

### Task 8: `team.ts` draft persistence (no default team)

**Files:**
- Modify: `client/src/lib/team.ts`
- Modify: `client/src/components/battle/BattleStage.test.tsx`
- Modify: `client/src/app/room/[id]/page.tsx:21,553`
- Test: `client/src/lib/team.test.ts`

**Interfaces:**
- Produces: `Team = Tier[]`; `getTeam(): Team` returns the saved team or `[]`; `saveTeam(team)` accepts drafts (0–4 distinct valid tiers); `isValidTeam(value)` is still exactly-4; `isValidTeamDraft(value)` is 0–4 distinct valid. `DEFAULT_TEAM` is removed.

- [ ] **Step 1: Write the failing tests**

Replace `client/src/lib/team.test.ts` entirely:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getTeam, saveTeam, isValidTeam } from './team'
import type { Team } from './team'

beforeEach(() => localStorage.clear())

describe('team persistence', () => {
  it('returns an empty team when nothing is stored', () => {
    expect(getTeam()).toEqual([])
  })

  it('round-trips a saved team', () => {
    saveTeam(['archer', 'paladin', 'wizard', 'saint'])
    expect(getTeam()).toEqual(['archer', 'paladin', 'wizard', 'saint'])
  })

  it('round-trips a partial draft', () => {
    saveTeam(['grunt', 'archer'])
    expect(getTeam()).toEqual(['grunt', 'archer'])
  })

  it('falls back to empty on corrupt JSON', () => {
    localStorage.setItem('typefight_team', 'not json')
    expect(getTeam()).toEqual([])
  })

  it('falls back to empty on invalid data', () => {
    localStorage.setItem('typefight_team', JSON.stringify(['grunt', 'grunt']))
    expect(getTeam()).toEqual([])
  })

  it('rejects save with duplicates or unknown tiers', () => {
    expect(() => saveTeam(['grunt', 'grunt'] as Team)).toThrow()
    expect(() => saveTeam(['grunt', 'nope'] as unknown as Team)).toThrow()
  })

  it('validates exactly 4 for play', () => {
    expect(isValidTeam(['grunt', 'archer', 'paladin', 'cleric'])).toBe(true)
    expect(isValidTeam(['grunt'])).toBe(false)
    expect(isValidTeam(['grunt', 'grunt', 'grunt', 'grunt'])).toBe(false)
    expect(isValidTeam('nope')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/team.test.ts`
Expected: FAIL (`getTeam()` returns the default team, not `[]`).

- [ ] **Step 3: Rewrite `team.ts`**

Replace `client/src/lib/team.ts` entirely:

```ts
import type { Tier } from './words'

export type Team = Tier[]

const STORAGE_KEY = 'typefight_team'
const TEAM_SIZE = 4

const VALID_TIERS: Tier[] = ['grunt', 'archer', 'paladin', 'wizard', 'cleric', 'priest', 'saint']

export function isValidTeamDraft(value: unknown): value is Team {
  if (!Array.isArray(value) || value.length > TEAM_SIZE) return false
  return (
    value.every(tier => VALID_TIERS.includes(tier as Tier)) &&
    new Set(value).size === value.length
  )
}

export function isValidTeam(value: unknown): value is Team {
  return Array.isArray(value) && value.length === TEAM_SIZE && isValidTeamDraft(value)
}

export function getTeam(): Team {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return []
  try {
    const parsed = JSON.parse(data)
    return isValidTeamDraft(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTeam(team: Team): void {
  if (!isValidTeamDraft(team)) throw new Error('Team must contain valid tiers, no duplicates, at most 4')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(team))
}
```

- [ ] **Step 4: Fix the other `DEFAULT_TEAM` consumers**

`client/src/components/battle/BattleStage.test.tsx`: remove `import { DEFAULT_TEAM } from '@/lib/team'`, add `import type { Team } from '@/lib/team'`, add `const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']` at the top, and replace all three `DEFAULT_TEAM` references (lines 14, 15, 25, 29, 34) with `TEAM_4`. (Keep `running={false}` — that prop is removed in Task 14.)

`client/src/app/room/[id]/page.tsx`: change line 21 import from

```ts
import { getTeam, DEFAULT_TEAM, type Team } from '@/lib/team'
```

to

```ts
import { getTeam, type Team } from '@/lib/team'
```

and change line 553 `opponentTeam={DEFAULT_TEAM}` to a literal (replaced by server data in Task 15):

```tsx
              opponentTeam={['grunt', 'archer', 'paladin', 'cleric']}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/team.ts client/src/lib/team.test.ts client/src/components/battle/BattleStage.test.tsx "client/src/app/room/[id]/page.tsx"
git commit -m "feat: persist team drafts with no default team"
```

---

### Task 9: Client protocol types + ready/start send the team

**Files:**
- Modify: `client/src/lib/ws.ts`
- Modify: `client/src/app/room/[id]/page.tsx:479-490`

**Interfaces:**
- Produces: `ClientMessage` `ready` variant becomes `{ type: 'ready'; team: Tier[] }`; `start_game` variant becomes `{ type: 'start_game'; team: Tier[] }`; `PlayerInfo` gains `team?: Tier[]`; `game_start` and `player_left` player entries gain `team?: Tier[]`.

- [ ] **Step 1: Update `ws.ts`**

Add the import at the top of `client/src/lib/ws.ts`:

```ts
import type { Tier } from './words'
```

Change `PlayerInfo`:

```ts
export interface PlayerInfo {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  hp?: number
  isAlive?: boolean
  team?: Tier[]
}
```

Change the message union:

```ts
export type ClientMessage =
  | { type: 'join'; player_name: string }
  | { type: 'ready'; team: Tier[] }
  | { type: 'start_game'; team: Tier[] }
  | { type: 'select_attack'; select_attack: { tier: Tier } }
  | { type: 'attack_complete'; attack_complete: { tier: Tier; phrase: string; correct: number; total: number } }
  | { type: 'switch_attack'; switch_attack: { tier: Tier } }
  | { type: 'play_again' }
```

Change `game_start` and `player_left` payload shapes:

```ts
  | { type: 'game_start'; players: { id: string; name: string; team?: Tier[] }[]; text: string; host_id?: string }
```

```ts
  | { type: 'player_left'; player_left: { playerID: string; new_host_id?: string; players: { id: string; name: string; team?: Tier[] }[] } }
```

- [ ] **Step 2: Update `handleReady` and `handleStartGame` in `page.tsx`**

`playerTeam` state already exists at line 80 (`useState<Team>(() => getTeam())`). Replace the two handlers:

```ts
  const handleReady = useCallback(() => {
    if (wsRef.current && playerTeam.length === 4) {
      sendMessage(wsRef.current, { type: 'ready', team: playerTeam })
      setIsReady(true)
    }
  }, [playerTeam])

  const handleStartGame = useCallback(() => {
    if (wsRef.current && playerTeam.length === 4) {
      sendMessage(wsRef.current, { type: 'start_game', team: playerTeam })
    }
  }, [playerTeam])
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd client && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/ws.ts "client/src/app/room/[id]/page.tsx"
git commit -m "feat: send team with ready and start_game messages"
```

---

### Task 10: `TeamPicker` component

**Files:**
- Create: `client/src/components/TeamPicker.tsx`
- Test: `client/src/components/TeamPicker.test.tsx`

**Interfaces:**
- Produces: `interface TeamPickerProps { team: Team; onChange: (team: Team) => void; disabled?: boolean }`. Click toggles membership (adds if `team.length < 4`); selected cards show order badges 1–4; a counter shows `n/4`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/TeamPicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import TeamPicker from './TeamPicker'
import type { Team } from '@/lib/team'

describe('TeamPicker', () => {
  it('renders all seven characters', () => {
    render(<TeamPicker team={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Grunt')).toBeInTheDocument()
    expect(screen.getByText('Archer')).toBeInTheDocument()
    expect(screen.getByText('Paladin')).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
    expect(screen.getByText('Cleric')).toBeInTheDocument()
    expect(screen.getByText('Priest')).toBeInTheDocument()
    expect(screen.getByText('Saint')).toBeInTheDocument()
  })

  it('adds a character on click', () => {
    const onChange = vi.fn()
    render(<TeamPicker team={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onChange).toHaveBeenCalledWith(['grunt'])
  })

  it('removes a selected character on click', () => {
    const onChange = vi.fn()
    render(<TeamPicker team={['grunt'] as Team} onChange={onChange} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('stops adding at 4', () => {
    const onChange = vi.fn()
    const team = ['grunt', 'archer', 'paladin', 'cleric'] as Team
    render(<TeamPicker team={team} onChange={onChange} />)
    fireEvent.click(screen.getByText('Wizard'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows order badges for selected characters', () => {
    render(<TeamPicker team={['cleric', 'grunt'] as Team} onChange={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows the pick counter', () => {
    render(<TeamPicker team={['grunt', 'archer'] as Team} onChange={vi.fn()} />)
    expect(screen.getByText(/2\/4/)).toBeInTheDocument()
  })

  it('does not toggle when disabled', () => {
    const onChange = vi.fn()
    render(<TeamPicker team={[]} onChange={onChange} disabled />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/TeamPicker.test.tsx`
Expected: FAIL (module `./TeamPicker` cannot be resolved).

- [ ] **Step 3: Write the component**

Create `client/src/components/TeamPicker.tsx`:

```tsx
'use client'

import Image from 'next/image'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'

interface CharacterOption {
  tier: Tier
  name: string
  value: number
  isHeal: boolean
}

const CHARACTERS: CharacterOption[] = [
  { tier: 'grunt',   name: 'Grunt',   value: 80,  isHeal: false },
  { tier: 'archer',  name: 'Archer',  value: 180, isHeal: false },
  { tier: 'paladin', name: 'Paladin', value: 350, isHeal: false },
  { tier: 'wizard',  name: 'Wizard',  value: 600, isHeal: false },
  { tier: 'cleric',  name: 'Cleric',  value: 60,  isHeal: true },
  { tier: 'priest',  name: 'Priest',  value: 140, isHeal: true },
  { tier: 'saint',   name: 'Saint',   value: 280, isHeal: true },
]

interface TeamPickerProps {
  team: Team
  onChange: (team: Team) => void
  disabled?: boolean
}

export default function TeamPicker({ team, onChange, disabled }: TeamPickerProps) {
  const toggleTier = (tier: Tier) => {
    if (disabled) return
    if (team.includes(tier)) {
      onChange(team.filter(t => t !== tier))
    } else if (team.length < 4) {
      onChange([...team, tier])
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Your Team</span>
        <span className={`text-xs ${team.length === 4 ? 'text-green-400' : 'text-gray-400'}`}>
          {team.length}/4 {team.length === 4 ? '— ready to battle' : 'pick exactly 4'}
        </span>
      </div>
      <div className={`grid grid-cols-4 gap-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {CHARACTERS.map(c => {
          const order = team.indexOf(c.tier)
          const selected = order >= 0
          return (
            <button
              key={c.tier}
              type="button"
              onClick={() => toggleTier(c.tier)}
              disabled={disabled}
              className={`relative flex flex-col items-center p-2 rounded-lg border transition-all ${
                selected ? 'bg-gray-700 border-green-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'
              }`}
            >
              {selected && (
                <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-green-500 text-black text-xs font-bold flex items-center justify-center">
                  {order + 1}
                </span>
              )}
              <Image
                src={`/sprites/${c.tier}_idle.svg`}
                alt={c.name}
                width={52}
                height={62}
                unoptimized
                className="select-none"
              />
              <div className="text-xs font-bold mt-1">{c.name}</div>
              <div className="text-xs text-gray-400">{c.isHeal ? `+${c.value} hp` : `${c.value} dmg`}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npm run lint && npx vitest run src/components/TeamPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TeamPicker.tsx client/src/components/TeamPicker.test.tsx
git commit -m "feat: add TeamPicker component"
```

---

### Task 11: Gate Ready/Start on a complete team

**Files:**
- Modify: `client/src/components/PlayerList.tsx`
- Test: `client/src/components/PlayerList.test.tsx`

**Interfaces:**
- Consumes: `Team` (not directly — a plain boolean). Produces: prop `teamComplete?: boolean`; non-host button shows `'Ready'` or `'Pick a team first'`; `canReady`/`canStart` require `teamComplete`.

- [ ] **Step 1: Write the failing tests**

Update `client/src/components/PlayerList.test.tsx`:

- In the tests `'shows Start Game button when host and 2 players and opponent ready'` and `'shows Ready button when not host'`, add `teamComplete={true}` to the props.
- Append these new tests:

```tsx
  it('shows a team prompt instead of Ready when the team is incomplete', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player2"
        gameStatus="lobby"
      />
    );
    expect(screen.getByText('Pick a team first')).toBeInTheDocument();
  });

  it('disables Start Game until the host team is complete', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player1"
        gameStatus="lobby"
        opponentReady={true}
      />
    );
    expect(screen.getByRole('button', { name: /Start Game/ })).toBeDisabled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/PlayerList.test.tsx`
Expected: FAIL — the new tests expect disabled/prompt states that don't exist.

- [ ] **Step 3: Update `PlayerList`**

Add the prop and use it:

```tsx
interface PlayerListProps {
  players: PlayerInfo[];
  hostId: string | null;
  currentPlayerId: string | null;
  gameStatus: string;
  onStartGame?: () => void;
  onReady?: () => void;
  isRoomFull?: boolean;
  isReady?: boolean;
  opponentReady?: boolean;
  teamComplete?: boolean;
}
```

```tsx
  const canStart = isHost && players.length === 2 && gameStatus === 'lobby' && !isRoomFull && opponentReady && !!teamComplete;
  const canReady = !isHost && players.length === 2 && gameStatus === 'lobby' && !isRoomFull && !!teamComplete;
```

Non-host button label:

```tsx
              {isReady ? 'Ready!' : teamComplete ? 'Ready' : 'Pick a team first'}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npm run lint && npx vitest run src/components/PlayerList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PlayerList.tsx client/src/components/PlayerList.test.tsx
git commit -m "feat: require a complete team before ready or start"
```

---

### Task 12: Home page team picker

**Files:**
- Modify: `client/src/app/page.tsx`

**Interfaces:**
- Consumes: `TeamPicker`, `getTeam`, `saveTeam`, `Team` (Tasks 8, 10). Produces: team state on the home page; create/join are not gated.

- [ ] **Step 1: Implement**

In `client/src/app/page.tsx`:

- Add imports:

```ts
import TeamPicker from '@/components/TeamPicker'
import { getTeam, saveTeam, type Team } from '@/lib/team'
```

- Add state and handler:

```tsx
  const [team, setTeam] = useState<Team>(() => getTeam())
```

```tsx
  const handleTeamChange = (newTeam: Team) => {
    setTeam(newTeam)
    saveTeam(newTeam)
  }
```

- Render the picker inside the card, after the name input and before the Create Room button:

```tsx
              <div className="pt-2">
                <TeamPicker team={team} onChange={handleTeamChange} />
              </div>
```

- [ ] **Step 2: Verify**

Run: `cd client && npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/app/page.tsx
git commit -m "feat: add team picker to home page"
```

---

### Task 13: `AttackSelector` filters to the team

**Files:**
- Modify: `client/src/components/AttackSelector.tsx`
- Modify: `client/src/app/room/[id]/page.tsx:760`
- Test: `client/src/components/AttackSelector.test.tsx`

**Interfaces:**
- Consumes: `Team` from `@/lib/team`; `playerTeam` in page.tsx. Produces: required prop `team: Team`; renders only team tiers; hotkeys outside the team are ignored; empty team renders `null`.

- [ ] **Step 1: Rewrite the tests**

Replace `client/src/components/AttackSelector.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AttackSelector from './AttackSelector'
import type { Team } from '@/lib/team'

const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']

describe('AttackSelector', () => {
  it('renders only the team members', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" team={TEAM_4} />)
    expect(screen.getByText('Grunt')).toBeInTheDocument()
    expect(screen.getByText('Archer')).toBeInTheDocument()
    expect(screen.getByText('Paladin')).toBeInTheDocument()
    expect(screen.getByText('Cleric')).toBeInTheDocument()
    expect(screen.queryByText('Wizard')).not.toBeInTheDocument()
    expect(screen.queryByText('Priest')).not.toBeInTheDocument()
    expect(screen.queryByText('Saint')).not.toBeInTheDocument()
  })

  it('shows damage and heal values for team members', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" team={TEAM_4} />)
    expect(screen.getByText('80 dmg')).toBeInTheDocument()
    expect(screen.getByText('180 dmg')).toBeInTheDocument()
    expect(screen.getByText('350 dmg')).toBeInTheDocument()
    expect(screen.getByText('+60 hp')).toBeInTheDocument()
    expect(screen.queryByText('600 dmg')).not.toBeInTheDocument()
    expect(screen.queryByText('+280 hp')).not.toBeInTheDocument()
  })

  it('calls onSelect when an attack button is clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" team={TEAM_4} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onSelect).toHaveBeenCalledWith('grunt')
  })

  it('calls onSelect when a heal button is clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" team={TEAM_4} />)
    fireEvent.click(screen.getByText('Cleric'))
    expect(onSelect).toHaveBeenCalledWith('cleric')
  })

  it('highlights current attack', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="archer" team={TEAM_4} />)
    const archerButton = screen.getByText('Archer').closest('button')
    expect(archerButton).toHaveClass('ring-2')
  })

  it('ignores hotkeys for tiers not in the team', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" team={TEAM_4} />)
    fireEvent.keyDown(window, { key: '1' })
    expect(onSelect).toHaveBeenCalledWith('grunt')
    fireEvent.keyDown(window, { key: '4' })
    expect(onSelect).not.toHaveBeenCalledWith('wizard')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for an empty team', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" team={[]} />)
    expect(screen.queryByText('Grunt')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/AttackSelector.test.tsx`
Expected: FAIL (component has no `team` prop).

- [ ] **Step 3: Update `AttackSelector`**

Add the import and prop, filter the render, and filter the keydown handler:

```tsx
'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import type { Team } from '@/lib/team'
```

```tsx
interface AttackSelectorProps {
  onSelect: (tier: AttackTier) => void
  currentAttack: string
  disabled?: boolean
  team: Team
}
```

```tsx
export default function AttackSelector({ onSelect, currentAttack, disabled, team }: AttackSelectorProps) {
  const visibleAttacks = attacks.filter(a => team.includes(a.tier))

  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const action = attacks.find(a => a.shortcut === e.key && team.includes(a.tier))
      if (action) {
        onSelect(action.tier)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelect, disabled, team])

  const renderButton = (attack: AttackOption) => {
    const isSelected = currentAttack === attack.tier
    const spriteSrc = `/sprites/${attack.tier}_${isSelected ? 'attack' : 'idle'}.svg`

    return (
      <button
        key={attack.tier}
        onClick={() => onSelect(attack.tier)}
        disabled={disabled}
        className={`
          flex flex-col items-center px-2 py-2 rounded-lg border transition-all
          ${isSelected
            ? 'bg-gray-800 ring-2'
            : 'bg-gray-900 border-gray-700 hover:bg-gray-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={isSelected ? {
          borderColor: attack.borderColor,
          boxShadow: `0 0 12px ${attack.color}55`,
          ['--tw-ring-color' as string]: attack.color,
        } : {}}
      >
        <Image
          src={spriteSrc}
          alt={attack.name}
          width={52}
          height={62}
          className="select-none"
          unoptimized
        />
        <div className="text-sm font-bold mt-1" style={{ color: attack.color }}>
          {attack.name}
        </div>
        <div className="text-xs text-gray-400">
          {attack.isHeal ? `+${attack.value} hp` : `${attack.value} dmg`}
        </div>
        <div className="text-xs text-gray-500">[{attack.shortcut}]</div>
      </button>
    )
  }

  if (visibleAttacks.length === 0) return null

  const attackTiers = visibleAttacks.filter(a => !a.isHeal)
  const healTiers = visibleAttacks.filter(a => a.isHeal)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {attackTiers.map(renderButton)}
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">heal</span>
        {healTiers.map(renderButton)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update the page usage**

In `client/src/app/room/[id]/page.tsx`, add the team prop to `AttackSelector`:

```tsx
              <AttackSelector
                onSelect={handleSelectAttack}
                currentAttack={currentAttack}
                disabled={gameState !== 'playing'}
                team={playerTeam}
              />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/AttackSelector.tsx client/src/components/AttackSelector.test.tsx "client/src/app/room/[id]/page.tsx"
git commit -m "feat: filter attack selector to the player's team"
```

---

### Task 14: Static battleground (remove the pan)

**Files:**
- Modify: `client/src/components/battle/ParallaxScene.tsx`
- Delete: `client/src/components/battle/parallax.ts`, `client/src/components/battle/parallax.test.ts`
- Modify: `client/src/components/battle/BattleStage.tsx`
- Modify: `client/src/app/room/[id]/page.tsx:549-558`
- Test: `client/src/components/battle/ParallaxScene.test.tsx`, `client/src/components/battle/BattleStage.test.tsx`

**Interfaces:**
- Consumes: `Battleground`. Produces: `ParallaxScene` takes only `{ battleground }` and renders one copy per layer; `BattleStage` drops the `running` prop.

- [ ] **Step 1: Rewrite the tests**

Replace `client/src/components/battle/ParallaxScene.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ParallaxScene from './ParallaxScene'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'

describe('ParallaxScene', () => {
  it('renders a single copy of every layer', () => {
    const { container } = render(<ParallaxScene battleground={BATTLEGROUNDS.battleground1} />)
    expect(container.querySelectorAll('img').length).toBe(BATTLEGROUNDS.battleground1.layers.length)
  })
})
```

In `client/src/components/battle/BattleStage.test.tsx`, remove the `running={false}` line from the render.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/battle/ParallaxScene.test.tsx src/components/battle/BattleStage.test.tsx`
Expected: FAIL (img count is `layers * 2`; `running` prop missing).

- [ ] **Step 3: Rewrite `ParallaxScene`**

Replace `client/src/components/battle/ParallaxScene.tsx` entirely:

```tsx
'use client'

import type { Battleground } from '@/lib/battlegrounds'

interface ParallaxSceneProps {
  battleground: Battleground
}

export default function ParallaxScene({ battleground }: ParallaxSceneProps) {
  const anchorClass = (anchor: 'top' | 'center' | 'bottom') =>
    anchor === 'top' ? 'object-top' : anchor === 'bottom' ? 'object-bottom' : 'object-center'

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {battleground.layers.map((layer, index) => (
        <img
          key={layer.id}
          src={layer.image}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover ${anchorClass(layer.anchor)}`}
          style={{ zIndex: index }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Delete the pan helpers**

Run: `rm client/src/components/battle/parallax.ts client/src/components/battle/parallax.test.ts`

- [ ] **Step 5: Drop `running` from `BattleStage`**

Remove `running` from the props interface and the `ParallaxScene` usage in `client/src/components/battle/BattleStage.tsx`:

```tsx
interface BattleStageProps {
  battleground: Battleground
  playerTeam: Team
  opponentTeam: Team
  activePlayerTier: Tier | null
  activeOpponentTier: Tier | null
  cameraMode: CameraMode
}
```

```tsx
export default function BattleStage({
  battleground,
  playerTeam,
  opponentTeam,
  activePlayerTier,
  activeOpponentTier,
  cameraMode,
}: BattleStageProps) {
```

```tsx
        <ParallaxScene battleground={battleground} />
```

- [ ] **Step 6: Drop `running` from the page call**

In `client/src/app/room/[id]/page.tsx`, remove the `running={gameState === 'playing'}` line from the `BattleStage` render.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd client && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/battle/ParallaxScene.tsx client/src/components/battle/BattleStage.tsx "client/src/app/room/[id]/page.tsx" client/src/components/battle/ParallaxScene.test.tsx client/src/components/battle/BattleStage.test.tsx
git rm client/src/components/battle/parallax.ts client/src/components/battle/parallax.test.ts
git commit -m "feat: render a static battleground without the parallax pan"
```

---

### Task 15: Wire teams end-to-end in the room page

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`
- Test: `client/src/app/room/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `TeamPicker`, `getTeam`/`saveTeam`/`Team` (Task 8), `ws.ts` player `team` fields (Task 9), `AttackSelector team` (Task 13), `BattleStage` without `running` (Task 14).
- Produces: `playerTeam` is editable via `TeamPicker` in the lobby (locked after ready / outside lobby); `opponentTeam` comes from the server player data; teams map through all message handlers.

- [ ] **Step 1: Add the setter and team mapping**

In `client/src/app/room/[id]/page.tsx`:

- Add `TeamPicker` and `saveTeam` imports:

```ts
import TeamPicker from '@/components/TeamPicker'
import { getTeam, saveTeam, type Team } from '@/lib/team'
```

- Add the setter to the existing state:

```ts
  const [playerTeam, setPlayerTeam] = useState<Team>(() => getTeam())
```

- Add `team?: Team` to the `Player` interface:

```ts
interface Player {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  hp?: number
  isAlive?: boolean
  team?: Team
}
```

- `player_list` handler — add `team` to the mapped player:

```tsx
          setPlayers(message.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: false,
            isHost: false,
            hp: 1000,
            isAlive: true,
            team: p.team ?? []
          })))
```

- `player_joined` handler — add `team`:

```tsx
            return [...prev, {
              id: message.player!.id,
              name: message.player!.name,
              ready: false,
              isHost: false,
              hp: 1000,
              isAlive: true,
              team: message.player!.team ?? []
            }]
```

- `game_start` handler — add `team`:

```tsx
          setPlayers(battlePlayers.map(p => ({
            id: p.id,
            name: p.name,
            ready: true,
            isHost: false,
            hp: 1000,
            isAlive: true,
            team: p.team ?? []
          })))
```

- `player_left` handler — add `team`:

```tsx
          setPlayers(message.player_left.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: false,
            isHost: message.player_left!.new_host_id ? p.id === message.player_left!.new_host_id : false,
            hp: currentPlayer?.hp || 1000,
            isAlive: true,
            team: (p as { team?: Tier[] }).team ?? []
          })))
```

- [ ] **Step 2: Derive the opponent team and update the scene**

Add the derived value near `opponentPlayer` (line ~526):

```ts
  const opponentTeam: Team = opponentPlayer?.team ?? []
```

Update the `BattleStage` render to use it (and remove the temporary literal from Task 8):

```tsx
            <BattleStage
              battleground={getBattleground(battlegroundId ?? undefined)}
              playerTeam={playerTeam}
              opponentTeam={opponentTeam}
              activePlayerTier={(currentAttack as Tier) || null}
              activeOpponentTier={(opponentAttack as Tier) || null}
              cameraMode={cameraMode}
            />
```

- [ ] **Step 3: Add the team change handler and the lobby picker**

Add the handler near the other callbacks:

```ts
  const handleTeamChange = useCallback((newTeam: Team) => {
    setPlayerTeam(newTeam)
    saveTeam(newTeam)
  }, [])
```

Replace the lobby `PlayerList` column so it also hosts the picker (locked once ready / outside lobby):

```tsx
          {(gameState === 'lobby' || gameState === 'finished') && (
            <div className="lg:col-span-1 space-y-4">
              <PlayerList
                players={players}
                hostId={hostId}
                currentPlayerId={playerId}
                gameStatus={gameState}
                onStartGame={handleStartGame}
                onReady={handleReady}
                isRoomFull={isRoomFull}
                isReady={isReady}
                opponentReady={opponentReady}
                teamComplete={playerTeam.length === 4}
              />
              <TeamPicker
                team={playerTeam}
                onChange={handleTeamChange}
                disabled={gameState !== 'lobby' || isReady}
              />
            </div>
          )}
```

- [ ] **Step 4: Update the page test**

In `client/src/app/room/[id]/page.test.tsx`, extend the render test to assert the picker is present:

```tsx
  it('renders lobby without crashing', () => {
    render(<RoomPage />)
    expect(document.querySelector('main')).toBeInTheDocument()
    expect(screen.getByText(/pick exactly 4/)).toBeInTheDocument()
  })
```

- [ ] **Step 5: Verify the full suite**

Run: `cd client && npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "client/src/app/room/[id]/page.tsx" "client/src/app/room/[id]/page.test.tsx"
git commit -m "feat: wire team picker and server teams into the room page"
```

---

## Final Verification

Run from the repo root:

```bash
cd server && go test ./...
cd client && npm run lint && npm test && npm run build
```

All must pass. Then run the full flow manually:

1. `cd server && make dev` and `cd client && npm run dev`.
2. Open two browser tabs, create a room in one, join in the other.
3. Home page shows the team picker; picks persist on reload.
4. Lobby: both players see the picker; Ready/Start stay disabled until each has 4/4; non-host locks after Ready; host's team is sent with Start.
5. Battle: `AttackSelector` shows only your 4; the battlefield shows both players' real teams; the background is static; the camera still zooms on attack select.
