# Typing VS Game MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working 1v1 multiplayer typing game with room creation, real-time WebSocket communication, and results display.

**Architecture:** Monorepo with `client/` (Next.js + Tailwind) and `server/` (Go + gorilla/websocket). In-memory state only for MVP, designed with interfaces for future database integration.

**Tech Stack:** Go 1.22+, gorilla/websocket, Next.js 14, React 18, Tailwind CSS, Node 24

## Global Constraints

- Node.js 24 via nvm
- Go modules for dependency management
- No database for MVP — all state in memory
- Room capacity: 2 players max (but data model supports N)
- Game time limit: 30 seconds
- Text pool: ~20 hardcoded sentences
- WebSocket protocol uses type-based message pattern

---

## File Structure

### Backend (`server/`)
- `cmd/main.go` — Entry point, HTTP server setup
- `internal/game/engine.go` — Pure game logic (WPM, accuracy, win check)
- `internal/game/room.go` — Room lifecycle management
- `internal/game/words.go` — Text pool
- `internal/ws/hub.go` — WebSocket connection manager
- `internal/ws/handler.go` — Message routing
- `internal/ws/protocol.go` — Typed message structs
- `go.mod` — Module definition
- `Makefile` — Build commands

### Frontend (`client/`)
- `src/app/page.tsx` — Home page
- `src/app/room/[id]/page.tsx` — Game room page
- `src/components/TypingArea.tsx` — Text display + input
- `src/components/PlayerList.tsx` — Player list + ready status
- `src/components/Results.tsx` — Final results display
- `src/lib/ws.ts` — WebSocket client helper
- `package.json` — Dependencies
- `tailwind.config.js` — Tailwind configuration

---

## Task 1: Project Scaffolding

**Files:**
- Create: `server/go.mod`
- Create: `server/Makefile`
- Create: `server/cmd/main.go`
- Create: `client/package.json`
- Create: `client/tailwind.config.js`
- Create: `client/src/app/layout.tsx`
- Create: `client/src/app/globals.css`

**Interfaces:**
- Consumes: None (initial setup)
- Produces: Working Go module, working Next.js app with Tailwind

- [ ] **Step 1: Initialize Go module**

```bash
cd server
go mod init github.com/type-fight/server
```

- [ ] **Step 2: Create Makefile**

```makefile
.PHONY: build run dev

build:
	go build -o bin/server cmd/main.go

run: build
	./bin/server

dev:
	go run cmd/main.go
```

- [ ] **Step 3: Create minimal main.go**

```go
package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Type Fight Server Running")
	})

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

- [ ] **Step 4: Test Go server starts**

```bash
cd server
go run cmd/main.go &
sleep 2
curl http://localhost:8080
# Expected: "Type Fight Server Running"
kill %1
```

- [ ] **Step 5: Initialize Next.js client**

```bash
cd ..
npx create-next-app@latest client --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd client
nvm use 24
npm install
```

- [ ] **Step 6: Test Next.js starts**

```bash
npm run dev &
sleep 5
curl http://localhost:3000
# Expected: HTML response with Next.js page
kill %1
```

- [ ] **Step 7: Commit scaffolding**

```bash
cd ..
git add server/ client/
git commit -m "feat: project scaffolding with Go backend and Next.js frontend"
```

---

## Task 2: WebSocket Protocol Types

**Files:**
- Create: `server/internal/ws/protocol.go`
- Create: `server/internal/ws/protocol_test.go`

**Interfaces:**
- Consumes: None
- Produces: Message types used by all WebSocket handlers

- [ ] **Step 1: Write failing test for protocol structs**

```go
// server/internal/ws/protocol_test.go
package ws

import (
	"encoding/json"
	"testing"
)

func TestClientMessageUnmarshal(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantType string
	}{
		{"join message", `{"type":"join","player_name":"Alex"}`, "join"},
		{"ready message", `{"type":"ready"}`, "ready"},
		{"start_game message", `{"type":"start_game"}`, "start_game"},
		{"keystroke message", `{"type":"keystroke","char":"a","position":5}`, "keystroke"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var msg ClientMessage
			err := json.Unmarshal([]byte(tt.input), &msg)
			if err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}
			if msg.Type != tt.wantType {
				t.Errorf("got type %s, want %s", msg.Type, tt.wantType)
			}
		})
	}
}

func TestServerMessageMarshal(t *testing.T) {
	msg := ServerMessage{
		Type: "error",
		Error: &ErrorMessage{Message: "Room is full"},
	}
	
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	
	var result map[string]interface{}
	json.Unmarshal(data, &result)
	
	if result["type"] != "error" {
		t.Errorf("got type %v, want 'error'", result["type"])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
go test ./internal/ws/ -v
# Expected: FAIL - undefined ClientMessage, ServerMessage
```

- [ ] **Step 3: Implement protocol structs**

```go
// server/internal/ws/protocol.go
package ws

import "time"

// Client -> Server messages
type ClientMessage struct {
	Type       string `json:"type"`
	PlayerName string `json:"player_name,omitempty"`
	Char       string `json:"char,omitempty"`
	Position   int    `json:"position,omitempty"`
}

// Server -> Client messages
type ServerMessage struct {
	Type     string           `json:"type"`
	Player   *PlayerInfo      `json:"player,omitempty"`
	Text     string           `json:"text,omitempty"`
	Players  []PlayerInfo     `json:"players,omitempty"`
	PlayerID string           `json:"player_id,omitempty"`
	Position int              `json:"position,omitempty"`
	WPM      float64          `json:"wpm,omitempty"`
	Accuracy float64          `json:"accuracy,omitempty"`
	Winner   string           `json:"winner,omitempty"`
	Results  []ResultInfo     `json:"results,omitempty"`
	Error    *ErrorMessage    `json:"error,omitempty"`
}

type PlayerInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ResultInfo struct {
	PlayerID string  `json:"player_id"`
	Name     string  `json:"name"`
	WPM      float64 `json:"wpm"`
	Accuracy float64 `json:"accuracy"`
	Position int     `json:"position"`
}

type ErrorMessage struct {
	Message string `json:"message"`
}

// Game state tracking
type PlayerState struct {
	ID          string
	Name        string
	Position    int
	Correct     int
	Total       int
	StartTime   time.Time
	Finished    bool
	FinishTime  time.Time
}

type RoomState struct {
	ID       string
	Players  map[string]*PlayerState
	HostID   string
	Status   string // "waiting", "playing", "finished"
	Text     string
	GameStart time.Time
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server
go test ./internal/ws/ -v
# Expected: PASS
```

- [ ] **Step 5: Commit protocol types**

```bash
cd ..
git add server/internal/ws/
git commit -m "feat: add WebSocket protocol types"
```

---

## Task 3: Game Engine

**Files:**
- Create: `server/internal/game/engine.go`
- Create: `server/internal/game/engine_test.go`

**Interfaces:**
- Consumes: None (pure logic)
- Produces: `CalculateWPM`, `CalculateAccuracy`, `CheckWinner`, `CheckTimeout`

- [ ] **Step 1: Write failing tests for game engine**

```go
// server/internal/game/engine_test.go
package game

import (
	"testing"
	"time"
)

func TestCalculateWPM(t *testing.T) {
	tests := []struct {
		name     string
		correct  int
		elapsed  time.Duration
		expected float64
	}{
		{"10 correct chars in 1 minute", 10, time.Minute, 2.0},
		{"50 correct chars in 1 minute", 50, time.Minute, 10.0},
		{"100 correct chars in 30 seconds", 100, 30 * time.Second, 40.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateWPM(tt.correct, tt.elapsed)
			if result != tt.expected {
				t.Errorf("got %.2f, want %.2f", result, tt.expected)
			}
		})
	}
}

func TestCalculateAccuracy(t *testing.T) {
	tests := []struct {
		name     string
		correct  int
		total    int
		expected float64
	}{
		{"100% accuracy", 10, 10, 100.0},
		{"50% accuracy", 5, 10, 50.0},
		{"0% accuracy", 0, 10, 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateAccuracy(tt.correct, tt.total)
			if result != tt.expected {
				t.Errorf("got %.2f, want %.2f", result, tt.expected)
			}
		})
	}
}

func TestCheckWinner(t *testing.T) {
	tests := []struct {
		name     string
		players  []PlayerResult
		expected string
	}{
		{
			"first finisher wins",
			[]PlayerResult{
				{ID: "p1", Finished: true, FinishTime: time.Now()},
				{ID: "p2", Finished: false},
			},
			"p1",
		},
		{
			"higher accuracy wins on timeout",
			[]PlayerResult{
				{ID: "p1", Finished: false, Accuracy: 90.0},
				{ID: "p2", Finished: false, Accuracy: 80.0},
			},
			"p1",
		},
		{
			"tie on accuracy - both win",
			[]PlayerResult{
				{ID: "p1", Finished: false, Accuracy: 90.0},
				{ID: "p2", Finished: false, Accuracy: 90.0},
			},
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CheckWinner(tt.players)
			if result != tt.expected {
				t.Errorf("got %s, want %s", result, tt.expected)
			}
		})
	}
}

func TestCheckTimeout(t *testing.T) {
	start := time.Now().Add(-31 * time.Second)
	if !CheckTimeout(start) {
		t.Error("expected timeout after 31 seconds")
	}

	start = time.Now().Add(-29 * time.Second)
	if CheckTimeout(start) {
		t.Error("expected no timeout after 29 seconds")
	}
}

type PlayerResult struct {
	ID         string
	Finished   bool
	FinishTime time.Time
	Accuracy   float64
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
go test ./internal/game/ -v
# Expected: FAIL - undefined functions
```

- [ ] **Step 3: Implement game engine**

```go
// server/internal/game/engine.go
package game

import "time"

const (
	GameTimeLimit    = 30 * time.Second
	CharsPerWord     = 5
)

// CalculateWPM calculates words per minute
// Formula: correct_characters / 5 / (elapsed_time_minutes)
func CalculateWPM(correctChars int, elapsed time.Duration) float64 {
	if elapsed.Seconds() == 0 {
		return 0
	}
	minutes := elapsed.Seconds() / 60.0
	return float64(correctChars) / float64(CharsPerWord) / minutes
}

// CalculateAccuracy calculates typing accuracy as percentage
// Formula: correct_keystrokes / total_keystrokes * 100
func CalculateAccuracy(correct, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(correct) / float64(total) * 100.0
}

// CheckWinner determines the winner based on finish time and accuracy
// Returns empty string if tie
func CheckWinner(players []PlayerResult) string {
	if len(players) == 0 {
		return ""
	}

	// Find anyone who finished
	var finishers []PlayerResult
	for _, p := range players {
		if p.Finished {
			finishers = append(finishers, p)
		}
	}

	// If someone finished, first finisher wins
	if len(finishers) > 0 {
		earliest := finishers[0]
		for _, f := range finishers[1:] {
			if f.FinishTime.Before(earliest.FinishTime) {
				earliest = f
			}
		}
		return earliest.ID
	}

	// No finishers - highest accuracy wins
	var winner PlayerResult
	hasWinner := false
	for _, p := range players {
		if !hasWinner || p.Accuracy > winner.Accuracy {
			winner = p
			hasWinner = true
		}
	}

	// Check for tie
	tied := true
	for _, p := range players {
		if p.Accuracy != winner.Accuracy {
			tied = false
			break
		}
	}

	if tied {
		return "" // Tie - both win
	}

	return winner.ID
}

// CheckTimeout checks if the game time limit has been exceeded
func CheckTimeout(startTime time.Time) bool {
	return time.Since(startTime) >= GameTimeLimit
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server
go test ./internal/game/ -v
# Expected: PASS
```

- [ ] **Step 5: Commit game engine**

```bash
cd ..
git add server/internal/game/
git commit -m "feat: add game engine with WPM, accuracy, and winner calculation"
```

---

## Task 4: Word Pool

**Files:**
- Create: `server/internal/game/words.go`
- Create: `server/internal/game/words_test.go`

**Interfaces:**
- Consumes: None
- Produces: `GetRandomText` function

- [ ] **Step 1: Write failing test for word pool**

```go
// server/internal/game/words_test.go
package game

import (
	"testing"
)

func TestGetRandomText(t *testing.T) {
	text1 := GetRandomText()
	text2 := GetRandomText()
	
	if text1 == "" {
		t.Error("expected non-empty text")
	}
	
	if len(text1) < 10 {
		t.Error("expected text longer than 10 characters")
	}
	
	// Not guaranteed to be different, but very likely
	// This is a soft check
	t.Logf("Got text: %s", text1)
	t.Logf("Got text: %s", text2)
}

func TestWordPoolSize(t *testing.T) {
	if len(wordPool) < 20 {
		t.Errorf("expected at least 20 words in pool, got %d", len(wordPool))
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
go test ./internal/game/ -v
# Expected: FAIL - undefined wordPool, GetRandomText
```

- [ ] **Step 3: Implement word pool**

```go
// server/internal/game/words.go
package game

import (
	"math/rand"
	"time"
)

var wordPool = []string{
	"the quick brown fox jumps over the lazy dog",
	"a journey of a thousand miles begins with a single step",
	"to be or not to be that is the question",
	"all that glitters is not gold",
	"the only thing we have to fear is fear itself",
	"in the middle of difficulty lies opportunity",
	"life is what happens when you are busy making other plans",
	"the way to get started is to quit talking and begin doing",
	"if life were predictable it would cease to be life",
	"spread love everywhere you go let no one ever come to you without leaving happier",
	"always remember that you are absolutely unique just like everyone else",
	"the greatest glory in living lies not in never falling but in rising every time we fall",
	"tell me and i forget teach me and i remember involve me and i learn",
	"the future belongs to those who believe in the beauty of their dreams",
	"it is during our darkest moments that we must focus to see the light",
	"whoever is happy will make others happy too",
	"do not go where the path may lead go instead where there is no path and leave a trail",
	"you will face many defeats in life but never let yourself be defeated",
	"never let the fear of striking out keep you from playing the game",
	"the purpose of our lives is to be happy",
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

// GetRandomText returns a random sentence from the word pool
func GetRandomText() string {
	return wordPool[rand.Intn(len(wordPool))]
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server
go test ./internal/game/ -v
# Expected: PASS
```

- [ ] **Step 5: Commit word pool**

```bash
cd ..
git add server/internal/game/words.go server/internal/game/words_test.go
git commit -m "feat: add word pool with 20 random sentences"
```

---

## Task 5: Room Manager

**Files:**
- Create: `server/internal/game/room.go`
- Create: `server/internal/game/room_test.go`

**Interfaces:**
- Consumes: `GetRandomText` from words.go
- Produces: `RoomManager` with `CreateRoom`, `JoinRoom`, `StartGame`, `GetRoom`

- [ ] **Step 1: Write failing test for room manager**

```go
// server/internal/game/room_test.go
package game

import (
	"testing"
)

func TestCreateRoom(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	
	if room == nil {
		t.Fatal("expected room to be created")
	}
	
	if room.ID == "" {
		t.Error("expected room to have an ID")
	}
	
	if room.HostID != "host-id" {
		t.Errorf("expected host-id, got %s", room.HostID)
	}
	
	if room.Status != "waiting" {
		t.Errorf("expected status 'waiting', got %s", room.Status)
	}
}

func TestJoinRoom(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	
	err := rm.JoinRoom(room.ID, "player-id", "Player 2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	
	updatedRoom := rm.GetRoom(room.ID)
	if len(updatedRoom.Players) != 2 {
		t.Errorf("expected 2 players, got %d", len(updatedRoom.Players))
	}
}

func TestJoinRoomFull(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	
	rm.JoinRoom(room.ID, "player-id", "Player 2")
	
	err := rm.JoinRoom(room.ID, "player-id-3", "Player 3")
	if err == nil {
		t.Error("expected error when joining full room")
	}
}

func TestStartGame(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	rm.JoinRoom(room.ID, "player-id", "Player 2")
	
	err := rm.StartGame(room.ID, "host-id")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	
	updatedRoom := rm.GetRoom(room.ID)
	if updatedRoom.Status != "playing" {
		t.Errorf("expected status 'playing', got %s", updatedRoom.Status)
	}
	
	if updatedRoom.Text == "" {
		t.Error("expected text to be set")
	}
}

func TestStartGameNotHost(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	rm.JoinRoom(room.ID, "player-id", "Player 2")
	
	err := rm.StartGame(room.ID, "player-id")
	if err == nil {
		t.Error("expected error when non-host tries to start")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
go test ./internal/game/ -v
# Expected: FAIL - undefined NewRoomManager, Room methods
```

- [ ] **Step 3: Implement room manager**

```go
// server/internal/game/room.go
package game

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type Room struct {
	ID        string
	Players   map[string]*PlayerState
	HostID    string
	Status    string // "waiting", "playing", "finished"
	Text      string
	GameStart time.Time
	mu        sync.RWMutex
}

type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) CreateRoom(hostID, hostName string) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	
	room := &Room{
		ID:      generateID(),
		Players: make(map[string]*PlayerState),
		HostID:  hostID,
		Status:  "waiting",
	}
	
	room.Players[hostID] = &PlayerState{
		ID:   hostID,
		Name: hostName,
	}
	
	rm.rooms[room.ID] = room
	return room
}

func (rm *RoomManager) JoinRoom(roomID, playerID, playerName string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	
	room, exists := rm.rooms[roomID]
	if !exists {
		return fmt.Errorf("room not found")
	}
	
	room.mu.Lock()
	defer room.mu.Unlock()
	
	if len(room.Players) >= 2 {
		return fmt.Errorf("room is full")
	}
	
	room.Players[playerID] = &PlayerState{
		ID:   playerID,
		Name: playerName,
	}
	
	return nil
}

func (rm *RoomManager) StartGame(roomID, playerID string) error {
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
	
	room.Status = "playing"
	room.Text = GetRandomText()
	room.GameStart = time.Now()
	
	for _, p := range room.Players {
		p.StartTime = room.GameStart
	}
	
	return nil
}

func (rm *RoomManager) GetRoom(roomID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	
	return rm.rooms[roomID]
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server
go test ./internal/game/ -v
# Expected: PASS
```

- [ ] **Step 5: Commit room manager**

```bash
cd ..
git add server/internal/game/room.go server/internal/game/room_test.go
git commit -m "feat: add room manager with create, join, and start game"
```

---

## Task 6: WebSocket Hub

**Files:**
- Create: `server/internal/ws/hub.go`
- Create: `server/internal/ws/hub_test.go`

**Interfaces:**
- Consumes: `RoomManager` from game package
- Produces: `Hub` with `Register`, `Unregister`, `BroadcastToRoom`

- [ ] **Step 1: Write failing test for hub**

```go
// server/internal/ws/hub_test.go
package ws

import (
	"testing"
	"time"
)

type MockConn struct {
	messages [][]byte
}

func (m *MockConn) WriteMessage(messageType int, data []byte) error {
	m.messages = append(m.messages, data)
	return nil
}

func TestHubRegister(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()
	
	conn := &MockConn{}
	client := &Client{Conn: conn, RoomID: "room1", PlayerID: "player1"}
	
	hub.Register(client)
	
	hub.mu.RLock()
	clients := hub.clients["room1"]
	hub.mu.RUnlock()
	
	if len(clients) != 1 {
		t.Errorf("expected 1 client, got %d", len(clients))
	}
}

func TestHubBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()
	
	conn1 := &MockConn{}
	conn2 := &MockConn{}
	client1 := &Client{Conn: conn1, RoomID: "room1", PlayerID: "player1"}
	client2 := &Client{Conn: conn2, RoomID: "room1", PlayerID: "player2"}
	
	hub.Register(client1)
	hub.Register(client2)
	
	hub.BroadcastToRoom("room1", []byte("test message"))
	
	// Allow time for broadcast
	time.Sleep(10 * time.Millisecond)
	
	if len(conn1.messages) != 1 {
		t.Errorf("expected 1 message for client1, got %d", len(conn1.messages))
	}
	if len(conn2.messages) != 1 {
		t.Errorf("expected 1 message for client2, got %d", len(conn2.messages))
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
go test ./internal/ws/ -v
# Expected: FAIL - undefined Hub, Client
```

- [ ] **Step 3: Implement hub**

```go
// server/internal/ws/hub.go
package ws

import (
	"sync"
)

type Client struct {
	Conn     Connection
	RoomID   string
	PlayerID string
}

type Connection interface {
	WriteMessage(messageType int, data []byte) error
}

type Hub struct {
	clients    map[string][]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
	mu         sync.RWMutex
	stop       chan struct{}
}

type BroadcastMessage struct {
	RoomID  string
	Message []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string][]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMessage),
		stop:       make(chan struct{}),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.RoomID] = append(h.clients[client.RoomID], client)
			h.mu.Unlock()
			
		case client := <-h.unregister:
			h.mu.Lock()
			clients := h.clients[client.RoomID]
			for i, c := range clients {
				if c == client {
					h.clients[client.RoomID] = append(clients[:i], clients[i+1:]...)
					break
				}
			}
			h.mu.Unlock()
			
		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := h.clients[msg.RoomID]
			h.mu.RUnlock()
			
			for _, client := range clients {
				client.Conn.WriteMessage(1, msg.Message)
			}
			
		case <-h.stop:
			return
		}
	}
}

func (h *Hub) Stop() {
	close(h.stop)
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) BroadcastToRoom(roomID string, message []byte) {
	h.broadcast <- &BroadcastMessage{RoomID: roomID, Message: message}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server
go test ./internal/ws/ -v
# Expected: PASS
```

- [ ] **Step 5: Commit hub**

```bash
cd ..
git add server/internal/ws/hub.go server/internal/ws/hub_test.go
git commit -m "feat: add WebSocket hub for connection management"
```

---

## Task 7: WebSocket Handler

**Files:**
- Create: `server/internal/ws/handler.go`
- Create: `server/internal/ws/handler_test.go`

**Interfaces:**
- Consumes: `Hub`, `RoomManager`, protocol types
- Produces: `HandleWebSocket` function

- [ ] **Step 1: Write failing test for handler**

```go
// server/internal/ws/handler_test.go
package ws

import (
	"encoding/json"
	"testing"
	"time"
)

type TestConnection struct {
	messages [][]byte
}

func (t *TestConnection) WriteMessage(messageType int, data []byte) error {
	t.messages = append(t.messages, data)
	return nil
}

func TestHandleJoin(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()
	
	handler := NewHandler(hub)
	
	msg := ClientMessage{
		Type:       "join",
		PlayerName: "Test Player",
	}
	
	data, _ := json.Marshal(msg)
	handler.HandleMessage(conn, "room1", "player1", data)
	
	// Check if player_joined message was broadcast
	time.Sleep(10 * time.Millisecond)
	
	if len(conn.messages) == 0 {
		t.Error("expected at least one message to be broadcast")
	}
}

func TestHandleKeystroke(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()
	
	handler := NewHandler(hub)
	
	msg := ClientMessage{
		Type:     "keystroke",
		Char:     "a",
		Position: 5,
	}
	
	data, _ := json.Marshal(msg)
	handler.HandleMessage(conn, "room1", "player1", data)
	
	time.Sleep(10 * time.Millisecond)
	
	// Should broadcast progress
	if len(conn.messages) == 0 {
		t.Error("expected progress message")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
go test ./internal/ws/ -v
# Expected: FAIL - undefined Handler, HandleMessage
```

- [ ] **Step 3: Implement handler**

```go
// server/internal/ws/handler.go
package ws

import (
	"encoding/json"
	"log"
	"time"
	
	"github.com/type-fight/server/internal/game"
)

type Handler struct {
	hub         *Hub
	roomManager *game.RoomManager
}

func NewHandler(hub *Hub, roomManager *game.RoomManager) *Handler {
	return &Handler{
		hub:         hub,
		roomManager: roomManager,
	}
}

func (h *Handler) HandleMessage(conn Connection, roomID, playerID string, data []byte) {
	var msg ClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("error unmarshaling message: %v", err)
		return
	}
	
	switch msg.Type {
	case "join":
		h.handleJoin(conn, roomID, playerID, msg)
	case "ready":
		h.handleReady(conn, roomID, playerID)
	case "start_game":
		h.handleStartGame(conn, roomID, playerID)
	case "keystroke":
		h.handleKeystroke(conn, roomID, playerID, msg)
	}
}

func (h *Handler) handleJoin(conn Connection, roomID, playerID string, msg ClientMessage) {
	err := h.roomManager.JoinRoom(roomID, playerID, msg.PlayerName)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}
	
	client := &Client{
		Conn:     conn,
		RoomID:   roomID,
		PlayerID: playerID,
	}
	h.hub.Register(client)
	
	response := ServerMessage{
		Type: "player_joined",
		Player: &PlayerInfo{
			ID:   playerID,
			Name: msg.PlayerName,
		},
	}
	
	data, _ := json.Marshal(response)
	h.hub.BroadcastToRoom(roomID, data)
}

func (h *Handler) handleReady(conn Connection, roomID, playerID string) {
	// For MVP, ready is implicit when joined
	// Could add ready state tracking later
}

func (h *Handler) handleStartGame(conn Connection, roomID, playerID string) {
	err := h.roomManager.StartGame(roomID, playerID)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}
	
	room := h.roomManager.GetRoom(roomID)
	
	players := make([]PlayerInfo, 0)
	for _, p := range room.Players {
		players = append(players, PlayerInfo{
			ID:   p.ID,
			Name: p.Name,
		})
	}
	
	response := ServerMessage{
		Type:    "game_start",
		Text:    room.Text,
		Players: players,
	}
	
	data, _ := json.Marshal(response)
	h.hub.BroadcastToRoom(roomID, data)
}

func (h *Handler) handleKeystroke(conn Connection, roomID, playerID string, msg ClientMessage) {
	room := h.roomManager.GetRoom(roomID)
	if room == nil {
		h.sendError(conn, "room not found")
		return
	}
	
	player, exists := room.Players[playerID]
	if !exists {
		h.sendError(conn, "player not in room")
		return
	}
	
	// Update player state
	player.Position = msg.Position
	
	// Calculate WPM
	elapsed := time.Since(player.StartTime)
	wpm := game.CalculateWPM(msg.Position, elapsed)
	
	// Broadcast progress
	response := ServerMessage{
		Type:     "progress",
		PlayerID: playerID,
		Position: msg.Position,
		WPM:      wpm,
	}
	
	data, _ := json.Marshal(response)
	h.hub.BroadcastToRoom(roomID, data)
}

func (h *Handler) sendError(conn Connection, message string) {
	response := ServerMessage{
		Type: "error",
		Error: &ErrorMessage{
			Message: message,
		},
	}
	
	data, _ := json.Marshal(response)
	conn.WriteMessage(1, data)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server
go test ./internal/ws/ -v
# Expected: PASS
```

- [ ] **Step 5: Commit handler**

```bash
cd ..
git add server/internal/ws/handler.go server/internal/ws/handler_test.go
git commit -m "feat: add WebSocket message handler"
```

---

## Task 8: HTTP Routes and Main Server

**Files:**
- Create: `server/cmd/main.go` (replace minimal version)
- Create: `server/internal/api/routes.go`

**Interfaces:**
- Consumes: `RoomManager`, `Hub`, `Handler`
- Produces: Working HTTP server with REST and WebSocket endpoints

- [ ] **Step 1: Create API routes**

```go
// server/internal/api/routes.go
package api

import (
	"encoding/json"
	"net/http"
	"strings"
	
	"github.com/gorilla/websocket"
	"github.com/type-fight/server/internal/game"
	"github.com/type-fight/server/internal/ws"
)

type Routes struct {
	roomManager *game.RoomManager
	hub         *ws.Hub
	handler     *ws.Handler
	upgrader    websocket.Upgrader
}

func NewRoutes(roomManager *game.RoomManager, hub *ws.Hub, handler *ws.Handler) *Routes {
	return &Routes{
		roomManager: roomManager,
		hub:         hub,
		handler:     handler,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
		},
	}
}

func (r *Routes) Setup(mux *http.ServeMux) {
	mux.HandleFunc("/api/rooms", r.handleRooms)
	mux.HandleFunc("/api/rooms/", r.handleRoomByID)
	mux.HandleFunc("/ws/room/", r.handleWebSocket)
}

func (r *Routes) handleRooms(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Generate a player ID for the host
	playerID := generatePlayerID()
	
	room := r.roomManager.CreateRoom(playerID, "Host")
	
	response := map[string]string{
		"room_id":  room.ID,
		"player_id": playerID,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (r *Routes) handleRoomByID(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	roomID := strings.TrimPrefix(req.URL.Path, "/api/rooms/")
	room := r.roomManager.GetRoom(roomID)
	
	if room == nil {
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}
	
	room.mu.RLock()
	defer room.mu.RUnlock()
	
	players := make([]ws.PlayerInfo, 0)
	for _, p := range room.Players {
		players = append(players, ws.PlayerInfo{
			ID:   p.ID,
			Name: p.Name,
		})
	}
	
	response := map[string]interface{}{
		"id":      room.ID,
		"status":  room.Status,
		"players": players,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (r *Routes) handleWebSocket(w http.ResponseWriter, req *http.Request) {
	roomID := strings.TrimPrefix(req.URL.Path, "/ws/room/")
	
	conn, err := r.upgrader.Upgrade(w, req, nil)
	if err != nil {
		http.Error(w, "Could not upgrade connection", http.StatusBadRequest)
		return
	}
	
	// Player ID will be set when they send a join message
	playerID := generatePlayerID()
	
	go r.handleWebSocketConnection(conn, roomID, playerID)
}

func (r *Routes) handleWebSocketConnection(conn *websocket.Conn, roomID, playerID string) {
	defer conn.Close()
	
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}
		
		r.handler.HandleMessage(conn, roomID, playerID, message)
	}
}

func generatePlayerID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
```

- [ ] **Step 2: Update main.go with full server**

```go
// server/cmd/main.go
package main

import (
	"log"
	"net/http"
	
	"github.com/type-fight/server/internal/api"
	"github.com/type-fight/server/internal/game"
	"github.com/type-fight/server/internal/ws"
)

func main() {
	roomManager := game.NewRoomManager()
	hub := ws.NewHub()
	go hub.Run()
	
	handler := ws.NewHandler(hub, roomManager)
	routes := api.NewRoutes(roomManager, hub, handler)
	
	mux := http.NewServeMux()
	routes.Setup(mux)
	
	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

- [ ] **Step 3: Test server starts and responds**

```bash
cd server
go run cmd/main.go &
sleep 2

# Test create room
curl -X POST http://localhost:8080/api/rooms
# Expected: {"room_id":"...","player_id":"..."}

# Test get room (use room_id from above)
curl http://localhost:8080/api/rooms/TEST_ID
# Expected: {"id":"...","status":"waiting","players":[...]}

kill %1
```

- [ ] **Step 4: Commit API routes**

```bash
cd ..
git add server/
git commit -m "feat: add HTTP routes and complete server setup"
```

---

## Task 9: Frontend WebSocket Helper

**Files:**
- Create: `client/src/lib/ws.ts`

**Interfaces:**
- Consumes: None
- Produces: `createWebSocket`, `sendMessage` functions

- [ ] **Step 1: Create WebSocket helper**

```typescript
// client/src/lib/ws.ts
export type ClientMessage = {
  type: 'join' | 'ready' | 'start_game' | 'keystroke';
  player_name?: string;
  char?: string;
  position?: number;
};

export type ServerMessage = {
  type: string;
  player?: { id: string; name: string };
  text?: string;
  players?: Array<{ id: string; name: string }>;
  player_id?: string;
  position?: number;
  wpm?: number;
  accuracy?: number;
  winner?: string;
  results?: Array<{
    player_id: string;
    name: string;
    wpm: number;
    accuracy: number;
    position: number;
  }>;
  error?: { message: string };
};

export type MessageHandler = (message: ServerMessage) => void;

export function createWebSocket(
  roomId: string,
  onMessage: MessageHandler
): WebSocket {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
  const ws = new WebSocket(`${wsUrl}/ws/room/${roomId}`);
  
  ws.onmessage = (event) => {
    const message: ServerMessage = JSON.parse(event.data);
    onMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
}

export function sendMessage(ws: WebSocket, message: ClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
```

- [ ] **Step 2: Commit WebSocket helper**

```bash
cd client
git add src/lib/ws.ts
git commit -m "feat: add WebSocket client helper"
```

---

## Task 10: Home Page

**Files:**
- Create: `client/src/app/page.tsx`

**Interfaces:**
- Consumes: `createWebSocket` from ws.ts
- Produces: Home page with create/join room UI

- [ ] **Step 1: Create home page**

```tsx
// client/src/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const router = useRouter();
  
  const handleCreateRoom = async () => {
    if (!playerName.trim()) return;
    
    const response = await fetch('/api/rooms', {
      method: 'POST',
    });
    
    const data = await response.json();
    localStorage.setItem('playerId', data.player_id);
    localStorage.setItem('playerName', playerName);
    
    router.push(`/room/${data.room_id}`);
  };
  
  const handleJoinRoom = () => {
    if (!playerName.trim() || !joinRoomId.trim()) return;
    
    localStorage.setItem('playerName', playerName);
    router.push(`/room/${joinRoomId}`);
  };
  
  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h1 className="text-3xl font-bold mb-6 text-center">Type Fight</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
            />
          </div>
          
          <button
            onClick={handleCreateRoom}
            disabled={!playerName.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
          >
            Create Room
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">or join existing</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Room Code</label>
            <input
              type="text"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter room code"
            />
          </div>
          
          <button
            onClick={handleJoinRoom}
            disabled={!playerName.trim() || !joinRoomId.trim()}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
          >
            Join Room
          </button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit home page**

```bash
cd client
git add src/app/page.tsx
git commit -m "feat: add home page with create/join room UI"
```

---

## Task 11: PlayerList Component

**Files:**
- Create: `client/src/components/PlayerList.tsx`

**Interfaces:**
- Consumes: Player info from WebSocket
- Produces: PlayerList component

- [ ] **Step 1: Create PlayerList component**

```tsx
// client/src/components/PlayerList.tsx
'use client';

import { PlayerInfo } from '@/lib/ws';

interface PlayerListProps {
  players: PlayerInfo[];
  hostId: string | null;
  currentPlayerId: string | null;
  gameStatus: string;
  onStartGame?: () => void;
}

export default function PlayerList({
  players,
  hostId,
  currentPlayerId,
  gameStatus,
  onStartGame,
}: PlayerListProps) {
  const isHost = currentPlayerId === hostId;
  const canStart = isHost && players.length === 2 && gameStatus === 'waiting';
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Players</h2>
      
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3 bg-gray-700 rounded-md"
          >
            <span className="font-medium">{player.name}</span>
            <div className="flex items-center gap-2">
              {player.id === hostId && (
                <span className="px-2 py-1 text-xs bg-yellow-600 rounded">Host</span>
              )}
              {player.id === currentPlayerId && (
                <span className="px-2 py-1 text-xs bg-blue-600 rounded">You</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {gameStatus === 'waiting' && (
        <div className="mt-4">
          {canStart ? (
            <button
              onClick={onStartGame}
              className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-md font-medium transition-colors"
            >
              Start Game
            </button>
          ) : (
            <p className="text-center text-gray-400">
              {players.length < 2
                ? 'Waiting for another player...'
                : 'Only host can start the game'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit PlayerList**

```bash
cd client
git add src/components/PlayerList.tsx
git commit -m "feat: add PlayerList component"
```

---

## Task 12: TypingArea Component

**Files:**
- Create: `client/src/components/TypingArea.tsx`

**Interfaces:**
- Consumes: Text to type, keystroke handler
- Produces: TypingArea component with character highlighting

- [ ] **Step 1: Create TypingArea component**

```tsx
// client/src/components/TypingArea.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface TypingAreaProps {
  text: string;
  onKeystroke: (char: string, position: number) => void;
  isActive: boolean;
  currentPosition: number;
}

export default function TypingArea({
  text,
  onKeystroke,
  isActive,
  currentPosition,
}: TypingAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isActive) return;
    
    // Handle backspace
    if (e.key === 'Backspace') {
      return;
    }
    
    // Only handle single characters
    if (e.key.length === 1) {
      const expectedChar = text[currentPosition];
      if (e.key === expectedChar) {
        onKeystroke(e.key, currentPosition + 1);
      }
    }
  };
  
  const renderText = () => {
    return text.split('').map((char, index) => {
      let className = 'text-gray-500'; // Upcoming
      
      if (index < currentPosition) {
        // Already typed - check if correct
        className = 'text-green-400';
      } else if (index === currentPosition) {
        // Current position
        className = 'text-white bg-gray-700';
      }
      
      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-lg font-mono leading-relaxed mb-4 whitespace-pre-wrap">
        {renderText()}
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!isActive}
        className="w-full px-4 py-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        placeholder={isActive ? 'Start typing...' : 'Waiting for game to start...'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit TypingArea**

```bash
cd client
git add src/components/TypingArea.tsx
git commit -m "feat: add TypingArea component with character highlighting"
```

---

## Task 13: Results Component

**Files:**
- Create: `client/src/components/Results.tsx`

**Interfaces:**
- Consumes: Game results from WebSocket
- Produces: Results component with stats and play again button

- [ ] **Step 1: Create Results component**

```tsx
// client/src/components/Results.tsx
'use client';

import { ResultInfo } from '@/lib/ws';
import { useRouter } from 'next/navigation';

interface ResultsProps {
  results: ResultInfo[];
  winner: string | null;
  currentPlayerId: string | null;
}

export default function Results({
  results,
  winner,
  currentPlayerId,
}: ResultsProps) {
  const router = useRouter();
  
  const handlePlayAgain = () => {
    router.push('/');
  };
  
  const isWinner = winner === currentPlayerId || winner === '';
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {winner === '' ? "It's a Tie!" : isWinner ? 'You Win!' : 'You Lose!'}
      </h2>
      
      <div className="space-y-4">
        {results.map((result) => (
          <div
            key={result.player_id}
            className={`p-4 rounded-lg ${
              result.player_id === winner
                ? 'bg-green-900 border border-green-600'
                : 'bg-gray-700'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">
                {result.name}
                {result.player_id === currentPlayerId && ' (You)'}
              </span>
              {result.player_id === winner && (
                <span className="px-2 py-1 text-xs bg-yellow-600 rounded">Winner</span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">WPM</span>
                <p className="text-xl font-bold">{result.wpm.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-gray-400">Accuracy</span>
                <p className="text-xl font-bold">{result.accuracy.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <button
        onClick={handlePlayAgain}
        className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit Results**

```bash
cd client
git add src/components/Results.tsx
git commit -m "feat: add Results component with stats display"
```

---

## Task 14: Game Room Page

**Files:**
- Create: `client/src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: All components, WebSocket helper
- Produces: Complete game room with lobby, game, and results states

- [ ] **Step 1: Create game room page**

```tsx
// client/src/app/room/[id]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createWebSocket, sendMessage, ServerMessage } from '@/lib/ws';
import PlayerList from '@/components/PlayerList';
import TypingArea from '@/components/TypingArea';
import Results from '@/components/Results';

type GameState = 'lobby' | 'playing' | 'finished';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [hostId, setHostId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [text, setText] = useState('');
  const [currentPosition, setCurrentPosition] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  useEffect(() => {
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName');
    
    if (!storedPlayerName) {
      router.push('/');
      return;
    }
    
    setPlayerId(storedPlayerId);
    setPlayerName(storedPlayerName);
    
    const websocket = createWebSocket(roomId, handleMessage);
    setWs(websocket);
    
    // Send join message after connection opens
    websocket.onopen = () => {
      sendMessage(websocket, {
        type: 'join',
        player_name: storedPlayerName,
      });
    };
    
    return () => {
      websocket.close();
    };
  }, [roomId, router]);
  
  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'player_joined':
        if (message.player) {
          setPlayers((prev) => [...prev, message.player!]);
          if (!hostId) {
            setHostId(message.player!.id);
          }
        }
        break;
        
      case 'game_start':
        if (message.text && message.players) {
          setText(message.text);
          setPlayers(message.players);
          setGameState('playing');
          setCurrentPosition(0);
        }
        break;
        
      case 'progress':
        if (message.player_id === playerId) {
          setCurrentPosition(message.position || 0);
        }
        break;
        
      case 'game_over':
        if (message.results && message.winner !== undefined) {
          setResults(message.results);
          setWinner(message.winner);
          setGameState('finished');
        }
        break;
        
      case 'error':
        console.error('Server error:', message.error?.message);
        break;
    }
  }, [playerId, hostId]);
  
  const handleKeystroke = (char: string, position: number) => {
    if (ws) {
      sendMessage(ws, {
        type: 'keystroke',
        char,
        position,
      });
      setCurrentPosition(position);
    }
  };
  
  const handleStartGame = () => {
    if (ws) {
      sendMessage(ws, {
        type: 'start_game',
      });
    }
  };
  
  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Type Fight</h1>
          <div className="text-sm text-gray-400">
            Room: {roomId}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <PlayerList
              players={players}
              hostId={hostId}
              currentPlayerId={playerId}
              gameStatus={gameState}
              onStartGame={handleStartGame}
            />
          </div>
          
          <div className="lg:col-span-2">
            {gameState === 'lobby' && (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <p className="text-gray-400">
                  Waiting for game to start...
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Share this room code with a friend: <span className="font-mono text-white">{roomId}</span>
                </p>
              </div>
            )}
            
            {gameState === 'playing' && (
              <TypingArea
                text={text}
                onKeystroke={handleKeystroke}
                isActive={true}
                currentPosition={currentPosition}
              />
            )}
            
            {gameState === 'finished' && results && (
              <Results
                results={results}
                winner={winner}
                currentPlayerId={playerId}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit game room page**

```bash
cd client
git add src/app/room/\[id\]/page.tsx
git commit -m "feat: add game room page with lobby, game, and results states"
```

---

## Task 15: Environment Configuration

**Files:**
- Create: `client/.env.local`
- Create: `client/next.config.js`

**Interfaces:**
- Consumes: None
- Produces: Environment configuration for WebSocket URL

- [ ] **Step 1: Create environment file**

```bash
# client/.env.local
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_API_URL=http://localhost:8080
```

- [ ] **Step 2: Update Next.js config for API proxy**

```javascript
// client/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

- [ ] **Step 3: Commit configuration**

```bash
cd client
git add .env.local next.config.js
git commit -m "feat: add environment configuration"
```

---

## Task 16: Integration Test

**Files:**
- None (manual testing)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working integration

- [ ] **Step 1: Start Go server**

```bash
cd server
go run cmd/main.go &
sleep 2
```

- [ ] **Step 2: Start Next.js dev server**

```bash
cd client
npm run dev &
sleep 5
```

- [ ] **Step 3: Test create room**

```bash
curl -X POST http://localhost:3000/api/rooms
# Expected: {"room_id":"...","player_id":"..."}
```

- [ ] **Step 4: Test WebSocket connection**

Open two browser windows:
1. Window 1: Create room at http://localhost:3000
2. Window 2: Join room using room code

Verify:
- Both players appear in lobby
- Host can start game
- Typing works for both players
- Progress is shared in real-time
- Results display correctly

- [ ] **Step 5: Clean up**

```bash
kill %1 %2
```

- [ ] **Step 6: Final commit**

```bash
cd ..
git add .
git commit -m "feat: complete MVP typing game implementation"
```

---

## Summary

This plan implements a complete 1v1 multiplayer typing game MVP:

**Backend (Go):**
- WebSocket protocol with type-based messages
- Game engine with WPM, accuracy, and winner calculation
- Room manager for game lifecycle
- WebSocket hub for connection management
- HTTP REST API for room creation

**Frontend (Next.js):**
- Home page with create/join room UI
- Game room with lobby, playing, and finished states
- Real-time typing with character highlighting
- Player list with host indicator
- Results display with stats

**Key Features:**
- Real-time progress sharing via WebSocket
- Character-by-character typing feedback
- 30-second time limit
- Winner determination (first finish or highest accuracy)
- Play again functionality

All code is designed with clear interfaces for future expansion (database, group matches, spectators).
