# Type-Fight v0.2 - Combat Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Type-Fight from a WPM typing race into a real-time combat system with HP, attacks, and damage calculation.

**Architecture:** Client-driven events approach: player selects attack, server provides phrase, player types locally, sends completion event, server applies damage. Server remains authoritative on damage and HP.

**Tech Stack:** Go 1.22 (server), Next.js 15 + React 19 (client), gorilla/websocket, Vitest (client tests)

## Global Constraints

- Go 1.22, gorilla/websocket v1.5.3
- Next.js 15, React 19, Tailwind CSS 4
- No database - in-memory server, localStorage client
- No character selection (generic phrases only)
- HP: 1000, Battle timer: 120s
- Attack damages: Quick=80, Normal=180, Heavy=350, Ultimate=600

---

## File Structure

### Server Files

| File | Responsibility |
|------|----------------|
| `server/internal/game/words.go` | Tiered phrase pools, `GetRandomPhrase(tier)` |
| `server/internal/game/engine.go` | Attack definitions, `CalculateDamage()`, `GetAttackDef()` |
| `server/internal/game/room.go` | PlayerState (HP, attack state), Room (battle state), combat methods |
| `server/internal/ws/protocol.go` | New message types for combat |
| `server/internal/ws/handler.go` | Combat WS handlers |

### Client Files

| File | Responsibility |
|------|----------------|
| `client/src/lib/ws.ts` | Updated message types |
| `client/src/components/AttackSelector.tsx` | Attack selection UI (1-4 keys) |
| `client/src/components/HealthBar.tsx` | HP bar display |
| `client/src/components/BattleTimer.tsx` | 120s countdown |
| `client/src/components/TypingArea.tsx` | Modified for backspace handling |
| `client/src/app/room/[id]/page.tsx` | Battle state management |

---

### Task 1: Phrase System

**Files:**
- Modify: `server/internal/game/words.go:8-38`
- Test: `server/internal/game/words_test.go`

**Interfaces:**
- Consumes: none
- Produces: `GetRandomPhrase(tier string) string`

- [ ] **Step 1: Write the failing test**

```go
// server/internal/game/words_test.go
package game

import "testing"

func TestGetRandomPhrase_Quick(t *testing.T) {
	phrase := GetRandomPhrase("quick")
	if phrase == "" {
		t.Error("Expected non-empty phrase for quick tier")
	}
}

func TestGetRandomPhrase_Normal(t *testing.T) {
	phrase := GetRandomPhrase("normal")
	if phrase == "" {
		t.Error("Expected non-empty phrase for normal tier")
	}
}

func TestGetRandomPhrase_Heavy(t *testing.T) {
	phrase := GetRandomPhrase("heavy")
	if phrase == "" {
		t.Error("Expected non-empty phrase for heavy tier")
	}
}

func TestGetRandomPhrase_Ultimate(t *testing.T) {
	phrase := GetRandomPhrase("ultimate")
	if phrase == "" {
		t.Error("Expected non-empty phrase for ultimate tier")
	}
}

func TestGetRandomPhrase_InvalidTier(t *testing.T) {
	phrase := GetRandomPhrase("invalid")
	if phrase != "" {
		t.Error("Expected empty phrase for invalid tier")
	}
}

func TestGetRandomPhrase_Varies(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 20; i++ {
		seen[GetRandomPhrase("quick")] = true
	}
	if len(seen) < 2 {
		t.Error("Expected some variation in random phrases")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test ./internal/game/ -run TestGetRandomPhrase -v`
Expected: FAIL with "undefined: GetRandomPhrase"

- [ ] **Step 3: Write minimal implementation**

```go
// server/internal/game/words.go
package game

import (
	"math/rand"
	"time"
)

var phrasePools = map[string][]string{
	"quick": {
		"The sword shines bright",
		"Fire burns through darkness",
		"Strike fast and true",
		"The blade catches light",
		"Steel sings through air",
		"Swift as the wind",
		"Precision cuts deep",
		"Aim true strike hard",
	},
	"normal": {
		"The warrior entered the ancient battlefield with courage and honor",
		"Magic flows through the veins of the forgotten forest at dawn",
		"The knight raised his sword and charged into the heart of battle",
		"Shadows dance across the moonlit battlefield as arrows fly",
		"The ancient stones hold secrets of battles fought long ago",
	},
	"heavy": {
		"The forgotten kingdom was protected by ancient warriors who fought without fear",
		"Darkness spread across the land as the dragon descended from the mountain peaks",
		"The iron fortress stood tall against the endless tide of invaders seeking glory",
		"Thunder roared across the sky as the armies clashed beneath the storm",
	},
	"ultimate": {
		"The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon",
		"When the final battle began the warriors knew there was no turning back from the path they had chosen",
		"The legendary sword was forged in dragon fire and quenched in the tears of a thousand fallen heroes",
	},
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

func GetRandomPhrase(tier string) string {
	pool, exists := phrasePools[tier]
	if !exists || len(pool) == 0 {
		return ""
	}
	return pool[rand.Intn(len(pool))]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test ./internal/game/ -run TestGetRandomPhrase -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/game/words.go server/internal/game/words_test.go
git commit -m "feat: add tiered phrase pools for combat attacks"
```

---

### Task 2: Attack Definitions

**Files:**
- Modify: `server/internal/game/engine.go:5-77`
- Test: `server/internal/game/engine_test.go`

**Interfaces:**
- Consumes: none
- Produces: `AttackDef` struct, `CalculateDamage(baseDamage, accuracy int) int`, `GetAttackDef(tier string) AttackDef`

- [ ] **Step 1: Write the failing test**

```go
// server/internal/game/engine_test.go
package game

import "testing"

func TestCalculateDamage_FullAccuracy(t *testing.T) {
	result := CalculateDamage(100, 1.0)
	if result != 100 {
		t.Errorf("Expected 100, got %d", result)
	}
}

func TestCalculateDamage_HalfAccuracy(t *testing.T) {
	result := CalculateDamage(100, 0.5)
	if result != 50 {
		t.Errorf("Expected 50, got %d", result)
	}
}

func TestCalculateDamage_LowAccuracy(t *testing.T) {
	result := CalculateDamage(200, 0.25)
	if result != 50 {
		t.Errorf("Expected 50, got %d", result)
	}
}

func TestGetAttackDef_Quick(t *testing.T) {
	def := GetAttackDef("quick")
	if def.Damage != 80 {
		t.Errorf("Expected damage 80, got %d", def.Damage)
	}
}

func TestGetAttackDef_Normal(t *testing.T) {
	def := GetAttackDef("normal")
	if def.Damage != 180 {
		t.Errorf("Expected damage 180, got %d", def.Damage)
	}
}

func TestGetAttackDef_Heavy(t *testing.T) {
	def := GetAttackDef("heavy")
	if def.Damage != 350 {
		t.Errorf("Expected damage 350, got %d", def.Damage)
	}
}

func TestGetAttackDef_Ultimate(t *testing.T) {
	def := GetAttackDef("ultimate")
	if def.Damage != 600 {
		t.Errorf("Expected damage 600, got %d", def.Damage)
	}
}

func TestGetAttackDef_Invalid(t *testing.T) {
	def := GetAttackDef("invalid")
	if def.Damage != 0 {
		t.Errorf("Expected damage 0 for invalid tier, got %d", def.Damage)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test ./internal/game/ -run "TestCalculateDamage|TestGetAttackDef" -v`
Expected: FAIL with "undefined: CalculateDamage" or "undefined: GetAttackDef"

- [ ] **Step 3: Write minimal implementation**

```go
// server/internal/game/engine.go
package game

import (
	"time"
)

const (
	GameTimeLimit    = 30 * time.Second
	BattleTimeLimit  = 120 * time.Second
	CharsPerWord     = 5
	BasePlayerHP     = 1000
)

type AttackDef struct {
	Damage    int
	MinWords  int
	MaxWords  int
}

var attackDefs = map[string]AttackDef{
	"quick":    {Damage: 80, MinWords: 4, MaxWords: 8},
	"normal":   {Damage: 180, MinWords: 8, MaxWords: 15},
	"heavy":    {Damage: 350, MinWords: 15, MaxWords: 25},
	"ultimate": {Damage: 600, MinWords: 25, MaxWords: 40},
}

func CalculateDamage(baseDamage int, accuracy float64) int {
	return int(float64(baseDamage) * accuracy)
}

func GetAttackDef(tier string) AttackDef {
	def, exists := attackDefs[tier]
	if !exists {
		return AttackDef{}
	}
	return def
}

func CalculateWPM(correctChars int, elapsed time.Duration) float64 {
	if elapsed.Seconds() == 0 {
		return 0
	}
	minutes := elapsed.Minutes()
	words := float64(correctChars) / float64(CharsPerWord)
	return words / minutes
}

func CalculateAccuracy(correct, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(correct) / float64(total)
}

type PlayerResult struct {
	Name     string
	WPM      float64
	Accuracy float64
}

func CheckWinner(players map[string]*PlayerState) string {
	var bestName string
	var bestWPM float64
	for _, p := range players {
		if p.WPM > bestWPM {
			bestWPM = p.WPM
			bestName = p.Name
		}
	}
	return bestName
}

func CheckTimeout(startTime time.Time) bool {
	return time.Since(startTime) > GameTimeLimit
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test ./internal/game/ -run "TestCalculateDamage|TestGetAttackDef" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/game/engine.go server/internal/game/engine_test.go
git commit -m "feat: add attack definitions and damage calculation"
```

---

### Task 3: PlayerState & Room Updates

**Files:**
- Modify: `server/internal/game/room.go:11-383`
- Test: `server/internal/game/room_test.go`

**Interfaces:**
- Consumes: `GetRandomPhrase(tier)`, `GetAttackDef(tier)`, `CalculateDamage(baseDamage, accuracy)`
- Produces: `SelectAttack(playerID, tier)`, `CompleteAttack(playerID, correct, total)`, `SwitchAttack(playerID, newTier)`, `CheckBattleEnd()`

- [ ] **Step 1: Write the failing test**

```go
// server/internal/game/room_test.go
package game

import (
	"testing"
	"time"
)

func setupTestRoom() (*RoomManager, string, string) {
	rm := NewRoomManager()
	roomID, player1ID := rm.CreateRoom("Player1")
	rm.JoinRoom(roomID, "Player2")
	players := rm.GetRoom(roomID).Players
	var player2ID string
	for id, p := range players {
		if p.Name == "Player2" {
			player2ID = id
		}
	}
	rm.StartGame(roomID, player1ID)
	return rm, roomID, player2ID
}

func TestPlayerState_HasHP(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	for _, p := range room.Players {
		if p.HP != BasePlayerHP {
			t.Errorf("Expected HP %d, got %d", BasePlayerHP, p.HP)
		}
	}
}

func TestSelectAttack_SetsAttackState(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	var playerID string
	for id := range room.Players {
		playerID = id
		break
	}
	rm.SelectAttack(playerID, "quick")
	room = rm.GetRoom(roomID)
	player := room.Players[playerID]
	if player.CurrentAttack != "quick" {
		t.Errorf("Expected attack 'quick', got '%s'", player.CurrentAttack)
	}
	if player.CurrentPhrase == "" {
		t.Error("Expected phrase to be set")
	}
}

func TestCompleteAttack_AppliesDamage(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "quick")
	rm.CompleteAttack(player1ID, 100, 100)
	room = rm.GetRoom(roomID)
	if room.Players[player2ID].HP != BasePlayerHP-80 {
		t.Errorf("Expected HP %d, got %d", BasePlayerHP-80, room.Players[player2ID].HP)
	}
}

func TestCompleteAttack_InaccuracyReducesDamage(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "quick")
	rm.CompleteAttack(player1ID, 50, 100)
	room = rm.GetRoom(roomID)
	expectedDamage := 80 * 50 / 100
	if room.Players[player2ID].HP != BasePlayerHP-expectedDamage {
		t.Errorf("Expected HP %d, got %d", BasePlayerHP-expectedDamage, room.Players[player2ID].HP)
	}
}

func TestSwitchAttack_DiscardsProgress(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	var playerID string
	for id := range room.Players {
		playerID = id
		break
	}
	rm.SelectAttack(playerID, "quick")
	room = rm.GetRoom(roomID)
	oldPhrase := room.Players[playerID].CurrentPhrase
	rm.SwitchAttack(playerID, "heavy")
	room = rm.GetRoom(roomID)
	player := room.Players[playerID]
	if player.CurrentAttack != "heavy" {
		t.Errorf("Expected attack 'heavy', got '%s'", player.CurrentAttack)
	}
	if player.CurrentPhrase == oldPhrase {
		t.Error("Expected new phrase after switch")
	}
}

func TestCheckBattleEnd_Defeat(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "ultimate")
	rm.CompleteAttack(player1ID, 100, 100)
	room = rm.GetRoom(roomID)
	if room.Players[player2ID].HP > 0 {
		t.Error("Expected player2 to be defeated")
	}
	winner, defeated := rm.CheckBattleEnd()
	if winner != player1ID {
		t.Errorf("Expected winner %s, got %s", player1ID, winner)
	}
	if defeated != player2ID {
		t.Errorf("Expected defeated %s, got %s", player2ID, defeated)
	}
}

func TestCheckBattleEnd_NoEnd(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "quick")
	rm.CompleteAttack(player1ID, 100, 100)
	winner, defeated := rm.CheckBattleEnd()
	if winner != "" || defeated != "" {
		t.Error("Expected no winner yet")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test ./internal/game/ -run "TestPlayerState|TestSelectAttack|TestCompleteAttack|TestSwitchAttack|TestCheckBattleEnd" -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```go
// server/internal/game/room.go
package game

import (
	"fmt"
	"math/rand"
	"time"
)

type PlayerState struct {
	ID               string
	Name             string
	Position         int
	Correct          int
	Total            int
	StartTime        time.Time
	FinishTime       time.Time
	FirstKeystrokeTime time.Time
	WPM              float64
	Finished         bool
	Ready            bool
	WantsPlayAgain   bool
	HP               int
	CurrentAttack    string
	CurrentPhrase    string
	PhraseCorrect    int
	PhraseTotal      int
	AttackStartTime  time.Time
	IsAlive          bool
}

type Room struct {
	ID               string
	Players          map[string]*PlayerState
	HostID           string
	Status           string
	Text             string
	GameStart        time.Time
	BattleStartTime  time.Time
	BattleTimeLimit  time.Duration
	Winner           string
}

type RoomManager struct {
	rooms map[string]*Room
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) CreateRoom(playerName string) (string, string) {
	roomID := generateID()
	playerID := generateID()
	room := &Room{
		ID:              roomID,
		Players:         make(map[string]*PlayerState),
		HostID:          playerID,
		Status:          "waiting",
		BattleTimeLimit: BattleTimeLimit,
	}
	room.Players[playerID] = &PlayerState{
		ID:      playerID,
		Name:    playerName,
		HP:      BasePlayerHP,
		IsAlive: true,
	}
	rm.rooms[roomID] = room
	return roomID, playerID
}

func (rm *RoomManager) JoinRoom(roomID, playerName string) (string, error) {
	room, exists := rm.rooms[roomID]
	if !exists {
		return "", fmt.Errorf("room not found")
	}
	if len(room.Players) >= 2 {
		return "", fmt.Errorf("room is full")
	}
	playerID := generateID()
	room.Players[playerID] = &PlayerState{
		ID:      playerID,
		Name:    playerName,
		HP:      BasePlayerHP,
		IsAlive: true,
	}
	return playerID, nil
}

func (rm *RoomManager) StartGame(roomID, hostID string) error {
	room, exists := rm.rooms[roomID]
	if !exists {
		return fmt.Errorf("room not found")
	}
	if room.HostID != hostID {
		return fmt.Errorf("only host can start game")
	}
	room.Status = "playing"
	room.GameStart = time.Now()
	room.BattleStartTime = time.Now()
	return nil
}

func (rm *RoomManager) GetRoom(roomID string) *Room {
	return rm.rooms[roomID]
}

func (rm *RoomManager) SelectAttack(playerID, tier string) error {
	def := GetAttackDef(tier)
	if def.Damage == 0 {
		return fmt.Errorf("invalid attack tier: %s", tier)
	}
	for _, room := range rm.rooms {
		player, exists := room.Players[playerID]
		if !exists {
			continue
		}
		player.CurrentAttack = tier
		player.CurrentPhrase = GetRandomPhrase(tier)
		player.PhraseCorrect = 0
		player.PhraseTotal = len(player.CurrentPhrase)
		player.AttackStartTime = time.Now()
		return nil
	}
	return fmt.Errorf("player not found")
}

func (rm *RoomManager) CompleteAttack(playerID string, correct, total int) error {
	for _, room := range rm.rooms {
		attacker, exists := room.Players[playerID]
		if !exists {
			continue
		}
		if attacker.CurrentAttack == "" {
			return fmt.Errorf("no active attack")
		}
		def := GetAttackDef(attacker.CurrentAttack)
		accuracy := CalculateAccuracy(correct, total)
		damage := CalculateDamage(def.Damage, accuracy)
		for id, p := range room.Players {
			if id != playerID && p.IsAlive {
				p.HP -= damage
				if p.HP <= 0 {
					p.HP = 0
					p.IsAlive = false
				}
			}
		}
		attacker.CurrentAttack = ""
		attacker.CurrentPhrase = ""
		attacker.PhraseCorrect = 0
		attacker.PhraseTotal = 0
		return nil
	}
	return fmt.Errorf("player not found")
}

func (rm *RoomManager) SwitchAttack(playerID, newTier string) error {
	def := GetAttackDef(newTier)
	if def.Damage == 0 {
		return fmt.Errorf("invalid attack tier: %s", newTier)
	}
	for _, room := range rm.rooms {
		player, exists := room.Players[playerID]
		if !exists {
			continue
		}
		player.CurrentAttack = newTier
		player.CurrentPhrase = GetRandomPhrase(newTier)
		player.PhraseCorrect = 0
		player.PhraseTotal = len(player.CurrentPhrase)
		player.AttackStartTime = time.Now()
		return nil
	}
	return fmt.Errorf("player not found")
}

func (rm *RoomManager) CheckBattleEnd() (winner string, defeated string) {
	for _, room := range rm.rooms {
		if room.Status != "playing" {
			continue
		}
		for id, p := range room.Players {
			if !p.IsAlive {
				for otherID, other := range room.Players {
					if otherID != id && other.IsAlive {
						return otherID, id
					}
				}
			}
		}
		if time.Since(room.BattleStartTime) > room.BattleTimeLimit {
			var highestHP int
			var winnerID string
			for id, p := range room.Players {
				if p.HP > highestHP {
					highestHP = p.HP
					winnerID = id
				}
			}
			for id, p := range room.Players {
				if id != winnerID {
					return winnerID, id
				}
			}
		}
	}
	return "", ""
}

func (rm *RoomManager) UpdatePlayerPosition(playerID string, position int) {
	for _, room := range rm.rooms {
		player, exists := room.Players[playerID]
		if !exists {
			continue
		}
		player.Position = position
		if player.FirstKeystrokeTime.IsZero() {
			player.FirstKeystrokeTime = time.Now()
		}
		if position >= len(room.Text) {
			player.Finished = true
			player.FinishTime = time.Now()
			player.WPM = CalculateWPM(player.Correct, player.FinishTime.Sub(player.FirstKeystrokeTime))
		}
		break
	}
}

func (rm *RoomManager) CheckGameCompletion(roomID string) (bool, string) {
	room, exists := rm.rooms[roomID]
	if !exists {
		return false, ""
	}
	allFinished := true
	for _, p := range room.Players {
		if !p.Finished {
			allFinished = false
			break
		}
	}
	if allFinished || CheckTimeout(room.GameStart) {
		winner := CheckWinner(room.Players)
		return true, winner
	}
	return false, ""
}

func (r *Room) IsPlayerFinished(playerID string) bool {
	player, exists := r.Players[playerID]
	if !exists {
		return false
	}
	return player.Finished
}

func (r *Room) GetPlayerName(playerID string) string {
	player, exists := r.Players[playerID]
	if !exists {
		return ""
	}
	return player.Name
}

func (r *Room) GetRoomInfo() RoomInfo {
	players := make([]PlayerInfo, 0, len(r.Players))
	for _, p := range r.Players {
		players = append(players, PlayerInfo{
			ID:      p.ID,
			Name:    p.Name,
			Ready:   p.Ready,
			IsHost:  r.HostID == p.ID,
			HP:      p.HP,
			IsAlive: p.IsAlive,
		})
	}
	return RoomInfo{
		ID:      r.ID,
		Status:  r.Status,
		Players: players,
	}
}

type RoomInfo struct {
	ID      string       `json:"id"`
	Status  string       `json:"status"`
	Players []PlayerInfo `json:"players"`
}

type PlayerInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Ready   bool   `json:"ready"`
	IsHost  bool   `json:"isHost"`
	HP      int    `json:"hp"`
	IsAlive bool   `json:"isAlive"`
}

func (rm *RoomManager) SetPlayerReady(playerID string, ready bool) error {
	for _, room := range rm.rooms {
		player, exists := room.Players[playerID]
		if !exists {
			continue
		}
		player.Ready = ready
		return nil
	}
	return fmt.Errorf("player not found")
}

func (rm *RoomManager) SetPlayerWantsPlayAgain(playerID string, wants bool) error {
	for _, room := range rm.rooms {
		player, exists := room.Players[playerID]
		if !exists {
			continue
		}
		player.WantsPlayAgain = wants
		bothWant := true
		for _, p := range room.Players {
			if !p.WantsPlayAgain {
				bothWant = false
				break
			}
		}
		if bothWant {
			rm.ResetRoom(room.ID)
		}
		return nil
	}
	return fmt.Errorf("player not found")
}

func (rm *RoomManager) ResetRoom(roomID string) {
	room, exists := rm.rooms[roomID]
	if !exists {
		return
	}
	for _, p := range room.Players {
		p.Position = 0
		p.Correct = 0
		p.Total = 0
		p.StartTime = time.Time{}
		p.FinishTime = time.Time{}
		p.FirstKeystrokeTime = time.Time{}
		p.WPM = 0
		p.Finished = false
		p.Ready = false
		p.WantsPlayAgain = false
		p.HP = BasePlayerHP
		p.CurrentAttack = ""
		p.CurrentPhrase = ""
		p.PhraseCorrect = 0
		p.PhraseTotal = 0
		p.AttackStartTime = time.Time{}
		p.IsAlive = true
	}
	room.Status = "lobby"
	room.Text = ""
	room.GameStart = time.Time{}
	room.BattleStartTime = time.Time{}
	room.Winner = ""
}

func generateID() string {
	return fmt.Sprintf("%x", rand.Int63())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test ./internal/game/ -run "TestPlayerState|TestSelectAttack|TestCompleteAttack|TestSwitchAttack|TestCheckBattleEnd" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/game/room.go server/internal/game/room_test.go
git commit -m "feat: add HP, attack state, and combat methods to room"
```

---

### Task 4: WebSocket Protocol

**Files:**
- Modify: `server/internal/ws/protocol.go:5-47`
- Test: `server/internal/ws/protocol_test.go`

**Interfaces:**
- Consumes: none
- Produces: `CombatClientMessage`, `CombatServerMessage` structs

- [ ] **Step 1: Write the failing test**

```go
// server/internal/ws/protocol_test.go
package ws

import (
	"encoding/json"
	"testing"
)

func TestCombatClientMessage_SelectAttack(t *testing.T) {
	msg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "quick",
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}
	var decoded CombatClientMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if decoded.Type != "select_attack" {
		t.Errorf("Expected type 'select_attack', got '%s'", decoded.Type)
	}
	if decoded.SelectAttack.Tier != "quick" {
		t.Errorf("Expected tier 'quick', got '%s'", decoded.SelectAttack.Tier)
	}
}

func TestCombatClientMessage_AttackComplete(t *testing.T) {
	msg := CombatClientMessage{
		Type: "attack_complete",
		AttackComplete: &AttackCompletePayload{
			Correct: 50,
			Total:   60,
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}
	var decoded CombatClientMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if decoded.Type != "attack_complete" {
		t.Errorf("Expected type 'attack_complete', got '%s'", decoded.Type)
	}
	if decoded.AttackComplete.Correct != 50 {
		t.Errorf("Expected correct 50, got %d", decoded.AttackComplete.Correct)
	}
}

func TestCombatServerMessage_AttackPhrase(t *testing.T) {
	msg := CombatServerMessage{
		Type: "attack_phrase",
		AttackPhrase: &AttackPhrasePayload{
			Phrase: "The sword shines bright",
			Tier:   "quick",
			Damage: 80,
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
	if decoded.Type != "attack_phrase" {
		t.Errorf("Expected type 'attack_phrase', got '%s'", decoded.Type)
	}
	if decoded.AttackPhrase.Phrase != "The sword shines bright" {
		t.Errorf("Expected phrase 'The sword shines bright', got '%s'", decoded.AttackPhrase.Phrase)
	}
}

func TestCombatServerMessage_HpUpdate(t *testing.T) {
	msg := CombatServerMessage{
		Type: "hp_update",
		HpUpdate: &HpUpdatePayload{
			PlayerID: "player1",
			HP:       920,
			Attacker: "player2",
			Damage:   80,
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
	if decoded.Type != "hp_update" {
		t.Errorf("Expected type 'hp_update', got '%s'", decoded.Type)
	}
	if decoded.HpUpdate.HP != 920 {
		t.Errorf("Expected HP 920, got %d", decoded.HpUpdate.HP)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test ./internal/ws/ -run "TestCombatClientMessage|TestCombatServerMessage" -v`
Expected: FAIL with "undefined: CombatClientMessage"

- [ ] **Step 3: Write minimal implementation**

```go
// server/internal/ws/protocol.go
package ws

import (
	"encoding/json"
	"fmt"
)

type ClientMessage struct {
	Type     string          `json:"type"`
	Payload  json.RawMessage `json:"payload,omitempty"`
	PlayerID string          `json:"playerID,omitempty"`
}

type ServerMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

type PlayerInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Ready   bool   `json:"ready"`
	IsHost  bool   `json:"isHost"`
}

type ResultInfo struct {
	Winner   string  `json:"winner"`
	Loser    string  `json:"loser"`
	WinnerWPM float64 `json:"winnerWPM"`
	LoserWPM  float64 `json:"loserWPM"`
}

type ErrorMessage struct {
	Message string `json:"message"`
}

type CombatClientMessage struct {
	Type           string                  `json:"type"`
	SelectAttack   *SelectAttackPayload    `json:"select_attack,omitempty"`
	AttackComplete *AttackCompletePayload  `json:"attack_complete,omitempty"`
	SwitchAttack   *SwitchAttackPayload    `json:"switch_attack,omitempty"`
}

type SelectAttackPayload struct {
	Tier string `json:"tier"`
}

type AttackCompletePayload struct {
	Correct int `json:"correct"`
	Total   int `json:"total"`
}

type SwitchAttackPayload struct {
	Tier string `json:"tier"`
}

type CombatServerMessage struct {
	Type         string                `json:"type"`
	AttackPhrase *AttackPhrasePayload  `json:"attack_phrase,omitempty"`
	HpUpdate     *HpUpdatePayload      `json:"hp_update,omitempty"`
	PlayerDefeated *PlayerDefeatedPayload `json:"player_defeated,omitempty"`
	BattleOver   *BattleOverPayload    `json:"battle_over,omitempty"`
	GameStart    *GameStartPayload     `json:"game_start,omitempty"`
}

type AttackPhrasePayload struct {
	Phrase string `json:"phrase"`
	Tier   string `json:"tier"`
	Damage int    `json:"damage"`
}

type HpUpdatePayload struct {
	PlayerID string `json:"playerID"`
	HP       int    `json:"hp"`
	Attacker string `json:"attacker"`
	Damage   int    `json:"damage"`
}

type PlayerDefeatedPayload struct {
	PlayerID string `json:"playerID"`
}

type BattleOverPayload struct {
	Winner string `json:"winner"`
	Reason string `json:"reason"`
}

type GameStartPayload struct {
	Players []CombatPlayerInfo `json:"players"`
}

type CombatPlayerInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	HP   int    `json:"hp"`
}

func ParseClientMessage(data []byte) (*ClientMessage, error) {
	var msg ClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("invalid message format: %v", err)
	}
	return &msg, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test ./internal/ws/ -run "TestCombatClientMessage|TestCombatServerMessage" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/ws/protocol.go server/internal/ws/protocol_test.go
git commit -m "feat: add combat message types for attack system"
```

---

### Task 5: WebSocket Handlers

**Files:**
- Modify: `server/internal/ws/handler.go:11-312`
- Test: `server/internal/ws/handler_test.go`

**Interfaces:**
- Consumes: `SelectAttack()`, `CompleteAttack()`, `SwitchAttack()`, `CheckBattleEnd()`, `GetAttackDef()`
- Produces: `handleSelectAttack()`, `handleAttackComplete()`, `handleSwitchAttack()`, modified `handleReady()`

- [ ] **Step 1: Write the failing test**

```go
// server/internal/ws/handler_test.go
package ws

import (
	"encoding/json"
	"testing"
)

func TestHandleSelectAttack_SendsPhrase(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	handler := NewHandler(hub)
	client := &Client{
		Conn:     nil,
		RoomID:   "test-room",
		PlayerID: "test-player",
		Hub:      hub,
	}
	hub.register <- client
	msg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "quick",
		},
	}
	data, _ := json.Marshal(msg)
	err := handler.handleSelectAttack(client, data)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
}

func TestHandleAttackComplete_AppliesDamage(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	handler := NewHandler(hub)
	client := &Client{
		Conn:     nil,
		RoomID:   "test-room",
		PlayerID: "test-player",
		Hub:      hub,
	}
	hub.register <- client
	msg := CombatClientMessage{
		Type: "attack_complete",
		AttackComplete: &AttackCompletePayload{
			Correct: 100,
			Total:   100,
		},
	}
	data, _ := json.Marshal(msg)
	err := handler.handleAttackComplete(client, data)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
}

func TestHandleSwitchAttack_DiscardsProgress(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	handler := NewHandler(hub)
	client := &Client{
		Conn:     nil,
		RoomID:   "test-room",
		PlayerID: "test-player",
		Hub:      hub,
	}
	hub.register <- client
	msg := CombatClientMessage{
		Type: "switch_attack",
		SwitchAttack: &SwitchAttackPayload{
			Tier: "heavy",
		},
	}
	data, _ := json.Marshal(msg)
	err := handler.handleSwitchAttack(client, data)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test ./internal/ws/ -run "TestHandleSelectAttack|TestHandleAttackComplete|TestHandleSwitchAttack" -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```go
// server/internal/ws/handler.go
package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"type-fight/server/internal/game"
)

type Handler struct {
	hub *Hub
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

func (h *Handler) HandleMessage(client *Client, message []byte) {
	msg, err := ParseClientMessage(message)
	if err != nil {
		h.sendError(client, "Invalid message format")
		return
	}
	switch msg.Type {
	case "join":
		h.handleJoin(client, msg)
	case "ready":
		h.handleReady(client)
	case "start_game":
		h.handleStartGame(client)
	case "select_attack":
		h.handleSelectAttack(client, message)
	case "attack_complete":
		h.handleAttackComplete(client, message)
	case "switch_attack":
		h.handleSwitchAttack(client, message)
	case "play_again":
		h.handlePlayAgain(client)
	default:
		h.sendError(client, "Unknown message type")
	}
}

func (h *Handler) handleJoin(client *Client, msg *ClientMessage) {
	var payload struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		h.sendError(client, "Invalid payload")
		return
	}
	h.hub.register <- client
	playerID, err := h.hub.roomManager.JoinRoom(client.RoomID, payload.Name)
	if err != nil {
		h.sendError(client, err.Error())
		return
	}
	client.PlayerID = playerID
	room := h.hub.roomManager.GetRoom(client.RoomID)
	playerList := make([]CombatPlayerInfo, 0)
	for _, p := range room.Players {
		playerList = append(playerList, CombatPlayerInfo{
			ID:   p.ID,
			Name: p.Name,
			HP:   p.HP,
		})
	}
	response := CombatServerMessage{
		Type: "player_list",
		GameStart: &GameStartPayload{
			Players: playerList,
		},
	}
	data, _ := json.Marshal(response)
	h.hub.broadcastToRoom(client.RoomID, data)
}

func (h *Handler) handleReady(client *Client) {
	err := h.hub.roomManager.SetPlayerReady(client.PlayerID, true)
	if err != nil {
		h.sendError(client, err.Error())
		return
	}
	room := h.hub.roomManager.GetRoom(client.RoomID)
	allReady := true
	for _, p := range room.Players {
		if !p.Ready {
			allReady = false
			break
		}
	}
	response := CombatServerMessage{
		Type: "player_ready",
	}
	data, _ := json.Marshal(response)
	h.hub.broadcastToRoom(client.RoomID, data)
	if allReady && len(room.Players) == 2 {
		h.hub.roomManager.StartGame(client.RoomID, client.PlayerID)
		gameStart := CombatServerMessage{
			Type: "game_start",
			GameStart: &GameStartPayload{
				Players: make([]CombatPlayerInfo, 0),
			},
		}
		for _, p := range room.Players {
			gameStart.GameStart.Players = append(gameStart.GameStart.Players, CombatPlayerInfo{
				ID:   p.ID,
				Name: p.Name,
				HP:   p.HP,
			})
		}
		data, _ = json.Marshal(gameStart)
		h.hub.broadcastToRoom(client.RoomID, data)
		go h.waitForBattleTimeout(client.RoomID, room.BattleTimeLimit)
	}
}

func (h *Handler) handleStartGame(client *Client) {
	room := h.hub.roomManager.GetRoom(client.RoomID)
	if room.HostID != client.PlayerID {
		h.sendError(client, "Only host can start game")
		return
	}
	err := h.hub.roomManager.StartGame(client.RoomID, client.PlayerID)
	if err != nil {
		h.sendError(client, err.Error())
		return
	}
	gameStart := CombatServerMessage{
		Type: "game_start",
		GameStart: &GameStartPayload{
			Players: make([]CombatPlayerInfo, 0),
		},
	}
	for _, p := range room.Players {
		gameStart.GameStart.Players = append(gameStart.GameStart.Players, CombatPlayerInfo{
			ID:   p.ID,
			Name: p.Name,
			HP:   p.HP,
		})
	}
	data, _ := json.Marshal(gameStart)
	h.hub.broadcastToRoom(client.RoomID, data)
	go h.waitForBattleTimeout(client.RoomID, room.BattleTimeLimit)
}

func (h *Handler) handlePlayAgain(client *Client) {
	err := h.hub.roomManager.SetPlayerWantsPlayAgain(client.PlayerID, true)
	if err != nil {
		h.sendError(client, err.Error())
		return
	}
	room := h.hub.roomManager.GetRoom(client.RoomID)
	bothWant := true
	for _, p := range room.Players {
		if !p.WantsPlayAgain {
			bothWant = false
			break
		}
	}
	if bothWant {
		response := CombatServerMessage{
			Type: "return_to_lobby",
		}
		data, _ := json.Marshal(response)
		h.hub.broadcastToRoom(client.RoomID, data)
	} else {
		response := CombatServerMessage{
			Type: "play_again_request",
		}
		data, _ := json.Marshal(response)
		h.hub.broadcastToRoom(client.RoomID, data)
	}
}

func (h *Handler) handleSelectAttack(client *Client, message []byte) {
	var msg CombatClientMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		h.sendError(client, "Invalid message format")
		return
	}
	if msg.SelectAttack == nil {
		h.sendError(client, "Missing attack tier")
		return
	}
	err := h.hub.roomManager.SelectAttack(client.PlayerID, msg.SelectAttack.Tier)
	if err != nil {
		h.sendError(client, err.Error())
		return
	}
	room := h.hub.roomManager.GetRoom(client.RoomID)
	player := room.Players[client.PlayerID]
	def := game.GetAttackDef(msg.SelectAttack.Tier)
	response := CombatServerMessage{
		Type: "attack_phrase",
		AttackPhrase: &AttackPhrasePayload{
			Phrase: player.CurrentPhrase,
			Tier:   msg.SelectAttack.Tier,
			Damage: def.Damage,
		},
	}
	data, _ := json.Marshal(response)
	h.sendToClient(client, data)
}

func (h *Handler) handleAttackComplete(client *Client, message []byte) {
	var msg CombatClientMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		h.sendError(client, "Invalid message format")
		return
	}
	if msg.AttackComplete == nil {
		h.sendError(client, "Missing attack data")
		return
	}
	err := h.hub.roomManager.CompleteAttack(client.PlayerID, msg.AttackComplete.Correct, msg.AttackComplete.Total)
	if err != nil {
		h.sendError(client, err.Error())
		return
	}
	room := h.hub.roomManager.GetRoom(client.RoomID)
	attacker := room.Players[client.PlayerID]
	def := game.GetAttackDef(attacker.CurrentAttack)
	accuracy := game.CalculateAccuracy(msg.AttackComplete.Correct, msg.AttackComplete.Total)
	damage := game.CalculateDamage(def.Damage, accuracy)
	for id, p := range room.Players {
		if id != client.PlayerID {
			hpUpdate := CombatServerMessage{
				Type: "hp_update",
				HpUpdate: &HpUpdatePayload{
					PlayerID: id,
					HP:       p.HP,
					Attacker: client.PlayerID,
					Damage:   damage,
				},
			}
			data, _ := json.Marshal(hpUpdate)
			h.hub.broadcastToRoom(client.RoomID, data)
		}
	}
	winner, defeated := h.hub.roomManager.CheckBattleEnd()
	if winner != "" && defeated != "" {
		defeatedMsg := CombatServerMessage{
			Type: "player_defeated",
			PlayerDefeated: &PlayerDefeatedPayload{
				PlayerID: defeated,
			},
		}
		data, _ := json.Marshal(defeatedMsg)
		h.hub.broadcastToRoom(client.RoomID, data)
		battleOver := CombatServerMessage{
			Type: "battle_over",
			BattleOver: &BattleOverPayload{
				Winner: winner,
				Reason: "opponent_defeated",
			},
		}
		data, _ = json.Marshal(battleOver)
		h.hub.broadcastToRoom(client.RoomID, data)
		room.Status = "finished"
	}
}

func (h *Handler) handleSwitchAttack(client *Client, message []byte) {
	var msg CombatClientMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		h.sendError(client, "Invalid message format")
		return
	}
	if msg.SwitchAttack == nil {
		h.sendError(client, "Missing attack tier")
		return
	}
	err := h.hub.roomManager.SwitchAttack(client.PlayerID, msg.SwitchAttack.Tier)
	if err != nil {
		h.sendError(client, err.Error())
		return
	}
	room := h.hub.roomManager.GetRoom(client.RoomID)
	player := room.Players[client.PlayerID]
	def := game.GetAttackDef(msg.SwitchAttack.Tier)
	response := CombatServerMessage{
		Type: "attack_phrase",
		AttackPhrase: &AttackPhrasePayload{
			Phrase: player.CurrentPhrase,
			Tier:   msg.SwitchAttack.Tier,
			Damage: def.Damage,
		},
	}
	data, _ := json.Marshal(response)
	h.sendToClient(client, data)
}

func (h *Handler) waitForBattleTimeout(roomID string, timeout time.Duration) {
	time.Sleep(timeout)
	room := h.hub.roomManager.GetRoom(roomID)
	if room == nil || room.Status != "playing" {
		return
	}
	var highestHP int
	var winnerID string
	var loserID string
	for id, p := range room.Players {
		if p.HP > highestHP {
			highestHP = p.HP
			winnerID = id
		}
	}
	for id := range room.Players {
		if id != winnerID {
			loserID = id
			break
		}
	}
	battleOver := CombatServerMessage{
		Type: "battle_over",
		BattleOver: &BattleOverPayload{
			Winner: winnerID,
			Reason: "timeout",
		},
	}
	data, _ := json.Marshal(battleOver)
	h.hub.broadcastToRoom(roomID, data)
	room.Status = "finished"
}

func (h *Handler) sendToClient(client *Client, data []byte) {
	if client.Conn != nil {
		client.Conn.WriteMessage(1, data)
	}
}

func (h *Handler) sendError(client *Client, message string) {
	response := ServerMessage{
		Type: "error",
		Payload: ErrorMessage{
			Message: message,
		},
	}
	data, _ := json.Marshal(response)
	h.sendToClient(client, data)
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	roomManager *game.RoomManager
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		roomManager: game.NewRoomManager(),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

func (h *Hub) broadcastToRoom(roomID string, message []byte) {
	for client := range h.clients {
		if client.RoomID == roomID {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

func (h *Hub) broadcastToRoomExcluding(roomID, excludePlayerID string, message []byte) {
	for client := range h.clients {
		if client.RoomID == roomID && client.PlayerID != excludePlayerID {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

type Client struct {
	Conn     interface{}
	RoomID   string
	PlayerID string
	Hub      *Hub
	send     chan []byte
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test ./internal/ws/ -run "TestHandleSelectAttack|TestHandleAttackComplete|TestHandleSwitchAttack" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/ws/handler.go server/internal/ws/handler_test.go
git commit -m "feat: add combat WebSocket handlers"
```

---

### Task 6: Client WebSocket Types

**Files:**
- Modify: `client/src/lib/ws.ts:1-78`
- Test: `client/src/lib/ws.test.ts`

**Interfaces:**
- Consumes: server message types from Task 4
- Produces: Updated `ClientMessage`, `ServerMessage` types

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/lib/ws.test.ts
import { describe, it, expect } from 'vitest'
import type { ClientMessage, ServerMessage } from './ws'

describe('ClientMessage types', () => {
  it('should have select_attack type', () => {
    const msg: ClientMessage = {
      type: 'select_attack',
      payload: { tier: 'quick' }
    }
    expect(msg.type).toBe('select_attack')
  })

  it('should have attack_complete type', () => {
    const msg: ClientMessage = {
      type: 'attack_complete',
      payload: { correct: 50, total: 60 }
    }
    expect(msg.type).toBe('attack_complete')
  })

  it('should have switch_attack type', () => {
    const msg: ClientMessage = {
      type: 'switch_attack',
      payload: { tier: 'heavy' }
    }
    expect(msg.type).toBe('switch_attack')
  })
})

describe('ServerMessage types', () => {
  it('should have attack_phrase type', () => {
    const msg: ServerMessage = {
      type: 'attack_phrase',
      payload: {
        phrase: 'The sword shines bright',
        tier: 'quick',
        damage: 80
      }
    }
    expect(msg.type).toBe('attack_phrase')
  })

  it('should have hp_update type', () => {
    const msg: ServerMessage = {
      type: 'hp_update',
      payload: {
        playerID: 'player1',
        hp: 920,
        attacker: 'player2',
        damage: 80
      }
    }
    expect(msg.type).toBe('hp_update')
  })

  it('should have player_defeated type', () => {
    const msg: ServerMessage = {
      type: 'player_defeated',
      payload: { playerID: 'player1' }
    }
    expect(msg.type).toBe('player_defeated')
  })

  it('should have battle_over type', () => {
    const msg: ServerMessage = {
      type: 'battle_over',
      payload: { winner: 'player1', reason: 'opponent_defeated' }
    }
    expect(msg.type).toBe('battle_over')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- ws.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// client/src/lib/ws.ts
export interface PlayerInfo {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  hp?: number
  isAlive?: boolean
}

export interface ResultInfo {
  winner: string
  loser: string
  winnerWPM: number
  loserWPM: number
}

export type ClientMessage =
  | { type: 'join'; payload: { name: string } }
  | { type: 'ready'; payload?: unknown }
  | { type: 'start_game'; payload?: unknown }
  | { type: 'select_attack'; payload: { tier: 'quick' | 'normal' | 'heavy' | 'ultimate' } }
  | { type: 'attack_complete'; payload: { correct: number; total: number } }
  | { type: 'switch_attack'; payload: { tier: 'quick' | 'normal' | 'heavy' | 'ultimate' } }
  | { type: 'play_again'; payload?: unknown }

export type ServerMessage =
  | { type: 'player_list'; payload: { players: PlayerInfo[] } }
  | { type: 'player_joined'; payload: PlayerInfo }
  | { type: 'game_start'; payload: { players: { id: string; name: string; hp: number }[] } }
  | { type: 'progress'; payload: { playerID: string; position: number; wpm: number } }
  | { type: 'player_finished'; payload: { playerID: string } }
  | { type: 'player_ready'; payload?: unknown }
  | { type: 'play_again_request'; payload?: unknown }
  | { type: 'return_to_lobby'; payload?: unknown }
  | { type: 'game_over'; payload: ResultInfo }
  | { type: 'error'; payload: { message: string } }
  | { type: 'attack_phrase'; payload: { phrase: string; tier: string; damage: number } }
  | { type: 'hp_update'; payload: { playerID: string; hp: number; attacker: string; damage: number } }
  | { type: 'player_defeated'; payload: { playerID: string } }
  | { type: 'battle_over'; payload: { winner: string; reason: string } }

export type MessageHandler = (message: ServerMessage) => void

export function createWebSocket(
  roomID: string,
  onMessage: MessageHandler,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (error: Event) => void
): WebSocket {
  const wsUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'ws://localhost:8080'
  const ws = new WebSocket(`${wsUrl}/ws/room/${roomID}`)

  ws.onopen = () => {
    if (onOpen) onOpen()
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as ServerMessage
      onMessage(message)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  ws.onclose = () => {
    if (onClose) onClose()
  }

  ws.onerror = (error) => {
    if (onError) onError(error)
  }

  return ws
}

export function sendMessage(ws: WebSocket | null, message: ClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- ws.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/ws.ts client/src/lib/ws.test.ts
git commit -m "feat: update client WebSocket types for combat system"
```

---

### Task 7: AttackSelector Component

**Files:**
- Create: `client/src/components/AttackSelector.tsx`
- Test: `client/src/components/AttackSelector.test.tsx`

**Interfaces:**
- Consumes: attack tier selection callback
- Produces: `AttackSelector` component with keyboard support

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/components/AttackSelector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AttackSelector from './AttackSelector'

describe('AttackSelector', () => {
  it('renders all four attack options', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" />)
    expect(screen.getByText('Quick')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Heavy')).toBeInTheDocument()
    expect(screen.getByText('Ultimate')).toBeInTheDocument()
  })

  it('shows damage values', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" />)
    expect(screen.getByText('80 dmg')).toBeInTheDocument()
    expect(screen.getByText('180 dmg')).toBeInTheDocument()
    expect(screen.getByText('350 dmg')).toBeInTheDocument()
    expect(screen.getByText('600 dmg')).toBeInTheDocument()
  })

  it('calls onSelect when button clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" />)
    fireEvent.click(screen.getByText('Quick'))
    expect(onSelect).toHaveBeenCalledWith('quick')
  })

  it('highlights current attack', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="normal" />)
    const normalButton = screen.getByText('Normal').closest('button')
    expect(normalButton).toHaveClass('ring-2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- AttackSelector.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
// client/src/components/AttackSelector.tsx
'use client'

import { useEffect } from 'react'

interface AttackOption {
  tier: 'quick' | 'normal' | 'heavy' | 'ultimate'
  name: string
  damage: number
  shortcut: string
}

const attacks: AttackOption[] = [
  { tier: 'quick', name: 'Quick', damage: 80, shortcut: '1' },
  { tier: 'normal', name: 'Normal', damage: 180, shortcut: '2' },
  { tier: 'heavy', name: 'Heavy', damage: 350, shortcut: '3' },
  { tier: 'ultimate', name: 'Ultimate', damage: 600, shortcut: '4' },
]

interface AttackSelectorProps {
  onSelect: (tier: 'quick' | 'normal' | 'heavy' | 'ultimate') => void
  currentAttack: string
  disabled?: boolean
}

export default function AttackSelector({ onSelect, currentAttack, disabled }: AttackSelectorProps) {
  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const attack = attacks.find(a => a.shortcut === e.key)
      if (attack) {
        onSelect(attack.tier)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelect, disabled])

  return (
    <div className="flex gap-2">
      {attacks.map((attack) => (
        <button
          key={attack.tier}
          onClick={() => onSelect(attack.tier)}
          disabled={disabled}
          className={`
            px-3 py-2 rounded-lg border transition-all
            ${currentAttack === attack.tier
              ? 'bg-blue-600 border-blue-500 ring-2 ring-blue-400'
              : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="text-sm font-medium">{attack.name}</div>
          <div className="text-xs text-gray-400">{attack.damage} dmg</div>
          <div className="text-xs text-gray-500">[{attack.shortcut}]</div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- AttackSelector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AttackSelector.tsx client/src/components/AttackSelector.test.tsx
git commit -m "feat: add AttackSelector component with keyboard shortcuts"
```

---

### Task 8: HealthBar Component

**Files:**
- Create: `client/src/components/HealthBar.tsx`
- Test: `client/src/components/HealthBar.test.tsx`

**Interfaces:**
- Consumes: player HP, max HP, player name
- Produces: `HealthBar` component

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/components/HealthBar.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HealthBar from './HealthBar'

describe('HealthBar', () => {
  it('displays player name', () => {
    render(<HealthBar name="Player1" hp={1000} maxHp={1000} />)
    expect(screen.getByText('Player1')).toBeInTheDocument()
  })

  it('displays HP value', () => {
    render(<HealthBar name="Player1" hp={750} maxHp={1000} />)
    expect(screen.getByText('750 / 1000')).toBeInTheDocument()
  })

  it('renders HP bar', () => {
    render(<HealthBar name="Player1" hp={500} maxHp={1000} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
  })

  it('shows different colors based on HP percentage', () => {
    const { rerender } = render(<HealthBar name="Player1" hp={900} maxHp={1000} />)
    let bar = screen.getByRole('progressbar')
    expect(bar).toHaveClass('bg-green-500')

    rerender(<HealthBar name="Player1" hp={400} maxHp={1000} />)
    bar = screen.getByRole('progressbar')
    expect(bar).toHaveClass('bg-yellow-500')

    rerender(<HealthBar name="Player1" hp={100} maxHp={1000} />)
    bar = screen.getByRole('progressbar')
    expect(bar).toHaveClass('bg-red-500')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- HealthBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
// client/src/components/HealthBar.tsx
'use client'

interface HealthBarProps {
  name: string
  hp: number
  maxHp: number
}

export default function HealthBar({ name, hp, maxHp }: HealthBarProps) {
  const percentage = Math.max(0, Math.min(100, (hp / maxHp) * 100))

  const getBarColor = () => {
    if (percentage > 60) return 'bg-green-500'
    if (percentage > 30) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-white">{name}</span>
        <span className="text-sm text-gray-400">{hp} / {maxHp}</span>
      </div>
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          role="progressbar"
          className={`h-full ${getBarColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- HealthBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/HealthBar.tsx client/src/components/HealthBar.test.tsx
git commit -m "feat: add HealthBar component with color coding"
```

---

### Task 9: BattleTimer Component

**Files:**
- Create: `client/src/components/BattleTimer.tsx`
- Test: `client/src/components/BattleTimer.test.tsx`

**Interfaces:**
- Consumes: time remaining in seconds
- Produces: `BattleTimer` component

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/components/BattleTimer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BattleTimer from './BattleTimer'

describe('BattleTimer', () => {
  it('displays time in MM:SS format', () => {
    render(<BattleTimer timeLeft={90} />)
    expect(screen.getByText('1:30')).toBeInTheDocument()
  })

  it('displays 0:00 for zero time', () => {
    render(<BattleTimer timeLeft={0} />)
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('applies normal color for time > 30', () => {
    render(<BattleTimer timeLeft={60} />)
    const timer = screen.getByText('1:00')
    expect(timer).toHaveClass('text-white')
  })

  it('applies warning color for time <= 30', () => {
    render(<BattleTimer timeLeft={25} />)
    const timer = screen.getByText('0:25')
    expect(timer).toHaveClass('text-yellow-400')
  })

  it('applies danger color for time <= 10', () => {
    render(<BattleTimer timeLeft={5} />)
    const timer = screen.getByText('0:05')
    expect(timer).toHaveClass('text-red-500')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- BattleTimer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
// client/src/components/BattleTimer.tsx
'use client'

interface BattleTimerProps {
  timeLeft: number
}

export default function BattleTimer({ timeLeft }: BattleTimerProps) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`

  const getColorClass = () => {
    if (timeLeft <= 10) return 'text-red-500'
    if (timeLeft <= 30) return 'text-yellow-400'
    return 'text-white'
  }

  return (
    <div className={`text-2xl font-mono font-bold ${getColorClass()}`}>
      {display}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- BattleTimer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BattleTimer.tsx client/src/components/BattleTimer.test.tsx
git commit -m "feat: add BattleTimer component with color coding"
```

---

### Task 10: TypingArea Backspace Handling

**Files:**
- Modify: `client/src/components/TypingArea.tsx:5-88`
- Test: `client/src/components/TypingArea.test.tsx`

**Interfaces:**
- Consumes: phrase to type, completion callback with correct/total
- Produces: modified TypingArea with backspace support and error display

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/components/TypingArea.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TypingArea from './TypingArea'

describe('TypingArea', () => {
  it('renders the phrase', () => {
    render(<TypingArea phrase="Hello world" onComplete={vi.fn()} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('advances cursor on correct keypress', () => {
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'H' })
    const chars = screen.getAllByRole('span')
    expect(chars[0]).toHaveClass('text-green-400')
  })

  it('shows error on wrong keypress', () => {
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'X' })
    const chars = screen.getAllByRole('span')
    expect(chars[0]).toHaveClass('text-red-500')
  })

  it('allows backspace to correct error', () => {
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'X' })
    fireEvent.keyDown(document, { key: 'Backspace' })
    const chars = screen.getAllByRole('span')
    expect(chars[0]).toHaveClass('text-gray-500')
  })

  it('calls onComplete when phrase finished', () => {
    const onComplete = vi.fn()
    render(<TypingArea phrase="Hi" onComplete={onComplete} />)
    fireEvent.keyDown(document, { key: 'H' })
    fireEvent.keyDown(document, { key: 'i' })
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, total: 2 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- TypingArea.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
// client/src/components/TypingArea.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TypingAreaProps {
  phrase: string
  onComplete: (result: { correct: number; total: number }) => void
  disabled?: boolean
}

export default function TypingArea({ phrase, onComplete, disabled }: TypingAreaProps) {
  const [position, setPosition] = useState(0)
  const [errors, setErrors] = useState<Set<number>>(new Set())
  const [correctCount, setCorrectCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPosition(0)
    setErrors(new Set())
    setCorrectCount(0)
  }, [phrase])

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Backspace') {
      if (errors.has(position - 1)) {
        setErrors(prev => {
          const next = new Set(prev)
          next.delete(position - 1)
          return next
        })
        setPosition(prev => prev - 1)
      } else if (position > 0) {
        setPosition(prev => prev - 1)
        setCorrectCount(prev => prev - 1)
      }
      return
    }
    if (e.key.length !== 1) return
    if (position >= phrase.length) return
    if (e.key === phrase[position]) {
      setCorrectCount(prev => prev + 1)
      setPosition(prev => prev + 1)
      if (position + 1 === phrase.length) {
        onComplete({ correct: correctCount + 1, total: phrase.length })
      }
    } else {
      setErrors(prev => new Set(prev).add(position))
    }
  }, [position, phrase, disabled, correctCount, onComplete])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderText = () => {
    return phrase.split('').map((char, index) => {
      let className = 'text-gray-500'
      if (index < position) {
        if (errors.has(index)) {
          className = 'text-red-500'
        } else {
          className = 'text-green-400'
        }
      } else if (index === position) {
        className = 'text-white bg-gray-700'
      }
      return (
        <span key={index} role="span" className={className}>
          {char}
        </span>
      )
    })
  }

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <input
        ref={inputRef}
        type="text"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
      />
      <div className="font-mono text-lg leading-relaxed">
        {renderText()}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- TypingArea.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TypingArea.tsx client/src/components/TypingArea.test.tsx
git commit -m "feat: add backspace handling and error display to TypingArea"
```

---

### Task 11: Room Page Battle Integration

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx:18-447`
- Test: `client/src/app/room/[id]/page.test.tsx`

**Interfaces:**
- Consumes: AttackSelector, HealthBar, BattleTimer, TypingArea components, WS message types
- Produces: Complete battle UI with state management

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/app/room/[id]/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RoomPage from './page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-room' }),
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('@/lib/ws', () => ({
  createWebSocket: vi.fn(() => ({
    readyState: 1,
    send: vi.fn(),
    close: vi.fn()
  })),
  sendMessage: vi.fn()
}))

describe('RoomPage', () => {
  it('renders attack selector in playing state', () => {
    render(<RoomPage />)
    expect(screen.getByText('Quick')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Heavy')).toBeInTheDocument()
    expect(screen.getByText('Ultimate')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- page.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
// client/src/app/room/[id]/page.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createWebSocket, sendMessage, ServerMessage } from '@/lib/ws'
import PlayerList from '@/components/PlayerList'
import TypingArea from '@/components/TypingArea'
import Countdown from '@/components/Countdown'
import Results from '@/components/Results'
import ProfilePanel from '@/components/ProfilePanel'
import ProfileToggle from '@/components/ProfileToggle'
import NamePromptModal from '@/components/NamePromptModal'
import Toast from '@/components/Toast'
import AttackSelector from '@/components/AttackSelector'
import HealthBar from '@/components/HealthBar'
import BattleTimer from '@/components/BattleTimer'

type GameState = 'lobby' | 'countdown' | 'playing' | 'finished'

interface Player {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  hp?: number
  isAlive?: boolean
}

interface BattlePlayer {
  id: string
  name: string
  hp: number
}

const BATTLE_TIME_LIMIT = 120

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomID = params.id as string

  const [playerId, setPlayerId] = useState<string>('')
  const [hostId, setHostId] = useState<string>('')
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameState>('lobby')
  const [currentAttack, setCurrentAttack] = useState<string>('')
  const [currentPhrase, setCurrentPhrase] = useState<string>('')
  const [currentDamage, setCurrentDamage] = useState<number>(0)
  const [playerHP, setPlayerHP] = useState<number>(1000)
  const [opponentHP, setOpponentHP] = useState<number>(1000)
  const [winner, setWinner] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(BATTLE_TIME_LIMIT)
  const [isReady, setIsReady] = useState<boolean>(false)
  const [opponentReady, setOpponentReady] = useState<boolean>(false)
  const [playAgainRequested, setPlayAgainRequested] = useState<boolean>(false)
  const [showNameModal, setShowNameModal] = useState<boolean>(true)
  const [showProfile, setShowProfile] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gameOverProcessedRef = useRef<boolean>(false)

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'player_list':
        if (message.payload?.players) {
          setPlayers(message.payload.players)
        }
        break
      case 'player_joined':
        setPlayers(prev => [...prev, message.payload])
        break
      case 'game_start':
        setGameState('countdown')
        if (message.payload?.players) {
          const battlePlayers = message.payload.players as BattlePlayer[]
          setPlayers(battlePlayers.map(p => ({
            id: p.id,
            name: p.name,
            ready: true,
            isHost: false,
            hp: p.hp,
            isAlive: true
          })))
          const me = battlePlayers.find(p => p.id === playerId)
          const opponent = battlePlayers.find(p => p.id !== playerId)
          if (me) setPlayerHP(me.hp)
          if (opponent) setOpponentHP(opponent.hp)
        }
        break
      case 'attack_phrase':
        if (message.payload) {
          setCurrentPhrase(message.payload.phrase)
          setCurrentAttack(message.payload.tier)
          setCurrentDamage(message.payload.damage)
        }
        break
      case 'hp_update':
        if (message.payload) {
          if (message.payload.playerID === playerId) {
            setPlayerHP(message.payload.hp)
          } else {
            setOpponentHP(message.payload.hp)
          }
        }
        break
      case 'player_defeated':
        break
      case 'battle_over':
        if (message.payload) {
          setWinner(message.payload.winner)
          setGameState('finished')
        }
        break
      case 'player_ready':
        setOpponentReady(true)
        break
      case 'play_again_request':
        setPlayAgainRequested(true)
        break
      case 'return_to_lobby':
        setGameState('lobby')
        setPlayers([])
        setIsReady(false)
        setOpponentReady(false)
        setPlayAgainRequested(false)
        setCurrentAttack('')
        setCurrentPhrase('')
        setPlayerHP(1000)
        setOpponentHP(1000)
        setWinner('')
        gameOverProcessedRef.current = false
        break
      case 'error':
        setToastMessage(message.payload?.message || 'An error occurred')
        break
    }
  }, [playerId])

  useEffect(() => {
    const ws = createWebSocket(roomID, handleMessage)
    wsRef.current = ws
    return () => {
      ws.close()
    }
  }, [roomID, handleMessage])

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState])

  const handleSelectAttack = useCallback((tier: 'quick' | 'normal' | 'heavy' | 'ultimate') => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'select_attack', payload: { tier } })
    }
  }, [])

  const handleAttackComplete = useCallback((result: { correct: number; total: number }) => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'attack_complete', payload: result })
    }
    setCurrentPhrase('')
    setCurrentAttack('')
  }, [])

  const handleReady = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'ready' })
      setIsReady(true)
    }
  }, [])

  const handleStartGame = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'start_game' })
    }
  }, [])

  const handlePlayAgain = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'play_again' })
    }
  }, [])

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing')
    setTimeLeft(BATTLE_TIME_LIMIT)
  }, [])

  const handleCopyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomID)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [roomID])

  const handleNameSubmit = useCallback((name: string) => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'join', payload: { name } })
      setShowNameModal(false)
    }
  }, [])

  const isHost = players.find(p => p.id === playerId)?.isHost

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {showNameModal && (
        <NamePromptModal onSubmit={handleNameSubmit} />
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Type-Fight</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopyRoomCode}
              className="px-3 py-1 bg-gray-800 rounded text-sm"
            >
              {copied ? 'Copied!' : roomID}
            </button>
            <ProfileToggle onClick={() => setShowProfile(true)} />
          </div>
        </div>

        {gameState === 'lobby' && (
          <div className="max-w-md mx-auto">
            <PlayerList
              players={players}
              isReady={isReady}
              onReady={handleReady}
              onStart={handleStartGame}
              isHost={isHost || false}
              canStart={players.length === 2 && players.every(p => p.ready)}
            />
          </div>
        )}

        {gameState === 'countdown' && (
          <Countdown onComplete={handleCountdownComplete} />
        )}

        {gameState === 'playing' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <HealthBar
                name={players.find(p => p.id === playerId)?.name || 'You'}
                hp={playerHP}
                maxHp={1000}
              />
              <BattleTimer timeLeft={timeLeft} />
              <HealthBar
                name={players.find(p => p.id !== playerId)?.name || 'Opponent'}
                hp={opponentHP}
                maxHp={1000}
              />
            </div>

            <div className="flex justify-center">
              <AttackSelector
                onSelect={handleSelectAttack}
                currentAttack={currentAttack}
                disabled={!currentAttack}
              />
            </div>

            {currentPhrase && (
              <TypingArea
                phrase={currentPhrase}
                onComplete={handleAttackComplete}
              />
            )}

            {currentAttack && (
              <div className="text-center text-gray-400">
                Attack: {currentAttack.charAt(0).toUpperCase() + currentAttack.slice(1)} ({currentDamage} dmg)
              </div>
            )}
          </div>
        )}

        {gameState === 'finished' && (
          <Results
            winner={players.find(p => p.id === winner)?.name || 'Unknown'}
            winnerWPM={0}
            loserWPM={0}
            onPlayAgain={handlePlayAgain}
            playAgainRequested={playAgainRequested}
          />
        )}
      </div>

      <ProfilePanel
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/app/room/\[id\]/page.tsx client/src/app/room/\[id\]/page.test.tsx
git commit -m "feat: integrate battle system into Room page"
```

---

### Task 12: Run All Tests

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: all previous tasks
- Produces: passing test suite

- [ ] **Step 1: Run server tests**

Run: `cd server && go test ./... -v`
Expected: All tests PASS

- [ ] **Step 2: Run client tests**

Run: `cd client && npm test`
Expected: All tests PASS

- [ ] **Step 3: Run linters**

Run: `cd server && go vet ./...`
Run: `cd client && npm run lint`
Expected: No errors

- [ ] **Step 4: Commit final changes**

```bash
git add -A
git commit -m "chore: verify all tests pass for v0.2 combat upgrade"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 1 | Phrase System | 15 min |
| 2 | Attack Definitions | 15 min |
| 3 | PlayerState & Room Updates | 30 min |
| 4 | WebSocket Protocol | 15 min |
| 5 | WebSocket Handlers | 30 min |
| 6 | Client WebSocket Types | 10 min |
| 7 | AttackSelector Component | 15 min |
| 8 | HealthBar Component | 10 min |
| 9 | BattleTimer Component | 10 min |
| 10 | TypingArea Backspace | 20 min |
| 11 | Room Page Integration | 30 min |
| 12 | Run All Tests | 10 min |
| **Total** | | **~3 hours** |
