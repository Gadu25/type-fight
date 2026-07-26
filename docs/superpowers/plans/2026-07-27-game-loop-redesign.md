# Game Loop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the game loop to support multi-game sessions with ready system and play-again request/accept flow.

**Architecture:** Server tracks player ready state and play-again requests. Room gains a "lobby" status for post-game state. Client adds ready/play-again UI without navigating away from the room.

**Tech Stack:** Go (server), Next.js 15 + React 19 + TypeScript (client), WebSocket

## Global Constraints

- All styling uses Tailwind utility classes (no CSS modules, no styled-components)
- Dark theme: bg-gray-800, bg-gray-700, bg-gray-900, white text
- Components use 'use client' directive
- Follow existing patterns in codebase
- Go server uses sync.RWMutex for thread safety

---

### Task 1: Server — Add Ready/WantsPlayAgain fields and ResetRoom function

**Files:**
- Modify: `server/internal/game/room.go`

**Interfaces:**
- Consumes: existing `PlayerState` struct, `Room` struct
- Produces: `PlayerState.Ready`, `PlayerState.WantsPlayAgain` fields, `ResetRoom()` function

- [ ] **Step 1: Add Ready and WantsPlayAgain fields to PlayerState**

In `server/internal/game/room.go`, add two fields to the `PlayerState` struct (after line 20):

```go
type PlayerState struct {
	ID               string
	Name             string
	Position         int
	Correct          int
	Total            int
	StartTime        time.Time
	Finished         bool
	FinishTime       time.Time
	FirstKeystrokeTime time.Time
	Ready            bool
	WantsPlayAgain   bool
}
```

- [ ] **Step 2: Add ResetRoom function**

Add this function at the end of `room.go`, before the `generateID` function:

```go
func (rm *RoomManager) ResetRoom(roomID string) error {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	room.Status = "lobby"
	room.Text = ""
	room.GameStart = time.Time{}

	for _, p := range room.Players {
		p.Position = 0
		p.Finished = false
		p.FinishTime = time.Time{}
		p.FirstKeystrokeTime = time.Time{}
		p.StartTime = time.Time{}
		p.Ready = false
		p.WantsPlayAgain = false
	}

	return nil
}
```

- [ ] **Step 3: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/internal/game/room.go
git commit -m "feat: add Ready/WantsPlayAgain fields and ResetRoom to room.go"
```

---

### Task 2: Server — Add new message types to protocol

**Files:**
- Modify: `server/internal/ws/protocol.go`

**Interfaces:**
- Consumes: existing `ServerMessage` struct
- Produces: new fields for `player_ready`, `play_again_request`, `return_to_lobby` messages

- [ ] **Step 1: Add new fields to ServerMessage**

In `server/internal/ws/protocol.go`, add these fields to the `ServerMessage` struct (after line 25):

```go
type ServerMessage struct {
	Type           string           `json:"type"`
	Player         *PlayerInfo      `json:"player,omitempty"`
	Text           string           `json:"text,omitempty"`
	Players        []PlayerInfo     `json:"players,omitempty"`
	PlayerID       string           `json:"player_id,omitempty"`
	YourPlayerID   string           `json:"your_player_id,omitempty"`
	Position       int              `json:"position,omitempty"`
	WPM            float64          `json:"wpm,omitempty"`
	Accuracy       float64          `json:"accuracy,omitempty"`
	Winner         string           `json:"winner,omitempty"`
	Results        []ResultInfo     `json:"results,omitempty"`
	Error          *ErrorMessage    `json:"error,omitempty"`
	PlayerFinished *PlayerInfo      `json:"player_finished,omitempty"`
	ReadyPlayerID  string           `json:"ready_player_id,omitempty"`
	OpponentName   string           `json:"opponent_name,omitempty"`
}
```

- [ ] **Step 2: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/internal/ws/protocol.go
git commit -m "feat: add player_ready and play_again_request message types"
```

---

### Task 3: Server — Implement handleReady

**Files:**
- Modify: `server/internal/ws/handler.go`

**Interfaces:**
- Consumes: `RoomManager.SetPlayerReady()` (to be added), `ServerMessage` types from Task 2
- Produces: `handleReady` implementation that marks player ready and starts game when both ready

- [ ] **Step 1: Add SetPlayerReady to RoomManager**

In `server/internal/game/room.go`, add this function before `ResetRoom`:

```go
func (rm *RoomManager) SetPlayerReady(roomID, playerID string) (bool, error) {
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

- [ ] **Step 2: Implement handleReady in handler.go**

Replace the existing `handleReady` no-op (lines 88-91) with:

```go
func (h *Handler) handleReady(conn Connection, roomID, playerID string) {
	allReady, err := h.roomManager.SetPlayerReady(roomID, playerID)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	readyMsg := ServerMessage{
		Type:          "player_ready",
		ReadyPlayerID: playerID,
	}
	readyData, _ := json.Marshal(readyMsg)
	h.hub.BroadcastToRoom(roomID, readyData)

	if allReady {
		room := h.roomManager.GetRoom(roomID)
		if room != nil && (room.Status == "waiting" || room.Status == "lobby") {
			h.handleStartGame(conn, roomID, playerID)
		}
	}
}
```

- [ ] **Step 3: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/internal/game/room.go server/internal/ws/handler.go
git commit -m "feat: implement handleReady with automatic game start"
```

---

### Task 4: Server — Implement handlePlayAgain

**Files:**
- Modify: `server/internal/ws/handler.go`

**Interfaces:**
- Consumes: `RoomManager` methods, `ResetRoom()` from Task 1
- Produces: `handlePlayAgain` implementation

- [ ] **Step 1: Add SetPlayerWantsPlayAgain to RoomManager**

In `server/internal/game/room.go`, add this function:

```go
func (rm *RoomManager) SetPlayerWantsPlayAgain(roomID, playerID string) (bool, error) {
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

	player.WantsPlayAgain = true

	allWant := true
	for _, p := range room.Players {
		if !p.WantsPlayAgain {
			allWant = false
			break
		}
	}

	return allWant, nil
}
```

- [ ] **Step 2: Add handlePlayAgain to handler.go**

Add this function to `handler.go`:

```go
func (h *Handler) handlePlayAgain(conn Connection, roomID, playerID string) {
	room := h.roomManager.GetRoom(roomID)
	if room == nil {
		h.sendError(conn, "room not found")
		return
	}

	playerName := room.GetPlayerName(playerID)

	allWant, err := h.roomManager.SetPlayerWantsPlayAgain(roomID, playerID)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	requestMsg := ServerMessage{
		Type:         "play_again_request",
		OpponentName: playerName,
	}
	requestData, _ := json.Marshal(requestMsg)
	h.hub.BroadcastToRoomExcept(roomID, playerID, requestData)

	if allWant {
		err := h.roomManager.ResetRoom(roomID)
		if err != nil {
			h.sendError(conn, err.Error())
			return
		}

		lobbyMsg := ServerMessage{
			Type: "return_to_lobby",
		}
		lobbyData, _ := json.Marshal(lobbyMsg)
		h.hub.BroadcastToRoom(roomID, lobbyData)
	}
}
```

- [ ] **Step 3: Register handlePlayAgain in HandleMessage switch**

In `handler.go`, add a case to the switch statement (after line 38):

```go
case "play_again":
	h.handlePlayAgain(conn, roomID, playerID)
```

- [ ] **Step 4: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add server/internal/game/room.go server/internal/ws/handler.go
git commit -m "feat: implement handlePlayAgain with room reset"
```

---

### Task 5: Server — Update StartGame to support lobby status

**Files:**
- Modify: `server/internal/game/room.go`

**Interfaces:**
- Consumes: existing `StartGame` function
- Produces: modified `StartGame` that works from "lobby" status

- [ ] **Step 1: Update StartGame to accept "lobby" status**

In `room.go`, modify the `StartGame` function. Change the status check (around line 100-106) to:

```go
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

	if room.Status != "waiting" && room.Status != "lobby" {
		return fmt.Errorf("game already in progress")
	}

	room.Status = "playing"
	room.Text = GetRandomText()
	room.GameStart = time.Now()

	for _, p := range room.Players {
		p.StartTime = room.GameStart
	}

	return nil
}
```

- [ ] **Step 2: Verify Go code compiles**

Run: `cd server && go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/internal/game/room.go
git commit -m "feat: allow StartGame from lobby status"
```

---

### Task 6: Server — Update and run tests

**Files:**
- Modify: `server/internal/game/room_test.go`
- Modify: `server/internal/integration/integration_test.go`

**Interfaces:**
- Consumes: all server-side changes from Tasks 1-5
- Produces: passing tests

- [ ] **Step 1: Add ResetRoom test**

In `server/internal/game/room_test.go`, add this test:

```go
func TestResetRoom(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-1", "Host")
	rm.JoinRoom(room.ID, "guest-1", "Guest")

	rm.StartGame(room.ID, "host-1")

	rm.mu.RLock()
	r := rm.rooms[room.ID]
	r.mu.Lock()
	r.Players["host-1"].Finished = true
	r.Players["host-1"].Ready = true
	r.Players["host-1"].WantsPlayAgain = true
	r.mu.Unlock()
	rm.mu.RUnlock()

	err := rm.ResetRoom(room.ID)
	if err != nil {
		t.Fatalf("ResetRoom failed: %v", err)
	}

	rm.mu.RLock()
	r = rm.rooms[room.ID]
	r.mu.RLock()
	defer r.mu.RUnlock()
	rm.mu.RUnlock()

	if r.Status != "lobby" {
		t.Errorf("expected status 'lobby', got %s", r.Status)
	}
	if r.Text != "" {
		t.Errorf("expected empty text, got %s", r.Text)
	}
	if r.Players["host-1"].Finished {
		t.Error("expected host Finished to be false")
	}
	if r.Players["host-1"].Ready {
		t.Error("expected host Ready to be false")
	}
	if r.Players["host-1"].WantsPlayAgain {
		t.Error("expected host WantsPlayAgain to be false")
	}
}
```

- [ ] **Step 2: Add SetPlayerReady test**

In `server/internal/game/room_test.go`, add this test:

```go
func TestSetPlayerReady(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-1", "Host")
	rm.JoinRoom(room.ID, "guest-1", "Guest")

	allReady, err := rm.SetPlayerReady(room.ID, "host-1")
	if err != nil {
		t.Fatalf("SetPlayerReady failed: %v", err)
	}
	if allReady {
		t.Error("expected allReady to be false after first player ready")
	}

	allReady, err = rm.SetPlayerReady(room.ID, "guest-1")
	if err != nil {
		t.Fatalf("SetPlayerReady failed: %v", err)
	}
	if !allReady {
		t.Error("expected allReady to be true after both players ready")
	}
}
```

- [ ] **Step 3: Add SetPlayerWantsPlayAgain test**

In `server/internal/game/room_test.go`, add this test:

```go
func TestSetPlayerWantsPlayAgain(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-1", "Host")
	rm.JoinRoom(room.ID, "guest-1", "Guest")

	allWant, err := rm.SetPlayerWantsPlayAgain(room.ID, "host-1")
	if err != nil {
		t.Fatalf("SetPlayerWantsPlayAgain failed: %v", err)
	}
	if allWant {
		t.Error("expected allWant to be false after first player")
	}

	allWant, err = rm.SetPlayerWantsPlayAgain(room.ID, "guest-1")
	if err != nil {
		t.Fatalf("SetPlayerWantsPlayAgain failed: %v", err)
	}
	if !allWant {
		t.Error("expected allWant to be true after both players")
	}
}
```

- [ ] **Step 4: Run server tests**

Run: `cd server && go test ./...`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add server/internal/game/room_test.go
git commit -m "test: add tests for ResetRoom, SetPlayerReady, SetPlayerWantsPlayAgain"
```

---

### Task 7: Client — Update WebSocket types

**Files:**
- Modify: `client/src/lib/ws.ts`

**Interfaces:**
- Consumes: existing `ServerMessage` type
- Produces: updated types for new message types

- [ ] **Step 1: Add play_again to ClientMessage type union**

In `client/src/lib/ws.ts`, update the `ClientMessage` type (line 14-19):

```typescript
export type ClientMessage = {
  type: 'join' | 'ready' | 'start_game' | 'keystroke' | 'play_again';
  player_name?: string;
  char?: string;
  position?: number;
};
```

- [ ] **Step 2: Add new fields to ServerMessage**

In `client/src/lib/ws.ts`, add fields to `ServerMessage` (after line 40):

```typescript
export type ServerMessage = {
  type: string;
  player?: { id: string; name: string };
  text?: string;
  players?: Array<{ id: string; name: string }>;
  player_id?: string;
  your_player_id?: string;
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
  player_finished?: { name: string; id: string };
  ready_player_id?: string;
  opponent_name?: string;
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/ws.ts
git commit -m "feat: add play_again and player_ready message types to ws.ts"
```

---

### Task 8: Client — Update PlayerList component

**Files:**
- Modify: `client/src/components/PlayerList.tsx`

**Interfaces:**
- Consumes: `PlayerInfo` from ws.ts
- Produces: updated `PlayerList` with ready UI

- [ ] **Step 1: Update PlayerList props and UI**

Replace the entire `PlayerList.tsx` file:

```tsx
'use client';

import { PlayerInfo } from '@/lib/ws';

interface PlayerListProps {
  players: PlayerInfo[];
  hostId: string | null;
  currentPlayerId: string | null;
  gameStatus: string;
  onStartGame?: () => void;
  onReady?: () => void;
  isReady?: boolean;
  opponentReady?: boolean;
  isRoomFull?: boolean;
}

export default function PlayerList({
  players,
  hostId,
  currentPlayerId,
  gameStatus,
  onStartGame,
  onReady,
  isReady = false,
  opponentReady = false,
  isRoomFull,
}: PlayerListProps) {
  const isHost = currentPlayerId === hostId;
  const canStart = isHost && players.length === 2 && gameStatus === 'lobby' && !isRoomFull && !isReady;
  const canReady = !isHost && players.length === 2 && gameStatus === 'lobby' && !isReady && opponentReady;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Players</h2>

      <div className="space-y-2">
        {players.map((player) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const playerReady = isCurrentPlayer ? isReady : opponentReady;

          return (
            <div
              key={player.id}
              className="flex items-center justify-between p-3 bg-gray-700 rounded-md"
            >
              <span className="font-medium">{player.name}</span>
              <div className="flex items-center gap-2">
                {playerReady && (
                  <span className="px-2 py-1 text-xs bg-green-600 rounded">Ready</span>
                )}
                {player.id === hostId && (
                  <span className="px-2 py-1 text-xs bg-yellow-600 rounded">Host</span>
                )}
                {isCurrentPlayer && (
                  <span className="px-2 py-1 text-xs bg-blue-600 rounded">You</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {gameStatus === 'lobby' && (
        <div className="mt-4 space-y-2">
          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
            >
              {isReady ? 'Waiting for opponent...' : 'Start Game'}
            </button>
          ) : (
            <button
              onClick={onReady}
              disabled={!canReady}
              className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
            >
              {isReady ? 'Waiting for game to start...' : 'Ready'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/PlayerList.tsx
git commit -m "feat: add ready UI to PlayerList component"
```

---

### Task 9: Client — Update Results component

**Files:**
- Modify: `client/src/components/Results.tsx`

**Interfaces:**
- Consumes: `ResultInfo` from ws.ts
- Produces: updated `Results` with in-room play again flow

- [ ] **Step 1: Update Results props and UI**

Replace the entire `Results.tsx` file:

```tsx
'use client';

import { ResultInfo } from '@/lib/ws';

interface ResultsProps {
  results: ResultInfo[];
  winner: string | null;
  currentPlayerId: string | null;
  onPlayAgain: () => void;
  playAgainRequested?: boolean;
}

export default function Results({
  results,
  winner,
  currentPlayerId,
  onPlayAgain,
  playAgainRequested = false,
}: ResultsProps) {
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

      {playAgainRequested && (
        <p className="text-center text-yellow-400 mt-4 text-sm">
          Your opponent wants to play again!
        </p>
      )}

      <button
        onClick={onPlayAgain}
        className={`w-full mt-6 py-3 rounded-md font-medium transition-colors ${
          playAgainRequested
            ? 'bg-yellow-600 hover:bg-yellow-700'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        Play Again
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Results.tsx
git commit -m "feat: update Results to use in-room play again flow"
```

---

### Task 10: Client — Update room page with ready/play again state and handlers

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: updated `PlayerList`, `Results`, `ws.ts` types from Tasks 7-9
- Produces: fully integrated room page with ready/play again flow

- [ ] **Step 1: Add new state variables**

In `client/src/app/room/[id]/page.tsx`, add after the existing state declarations (around line 41):

```typescript
const [isReady, setIsReady] = useState(false);
const [opponentReady, setOpponentReady] = useState(false);
const [playAgainRequested, setPlayAgainRequested] = useState(false);
```

- [ ] **Step 2: Add player_ready message handler**

In the `handleMessage` callback, add a new case after the `player_joined` case (around line 144):

```typescript
case 'player_ready':
  if (message.ready_player_id) {
    if (message.ready_player_id === playerId) {
      setIsReady(true);
    } else {
      setOpponentReady(true);
    }
  }
  break;
```

- [ ] **Step 3: Add play_again_request message handler**

Add another case after `player_ready`:

```typescript
case 'play_again_request':
  setPlayAgainRequested(true);
  setToastMessage(`Your opponent wants to play again!`);
  break;
```

- [ ] **Step 4: Add return_to_lobby message handler**

Add another case after `play_again_request`:

```typescript
case 'return_to_lobby':
  setGameState('lobby');
  setResults(null);
  setWinner(null);
  setIsReady(false);
  setOpponentReady(false);
  setPlayAgainRequested(false);
  setToastMessage(null);
  setText('');
  setCurrentPosition(0);
  setEnemyPosition(0);
  setEnemyName('');
  gameOverProcessedRef.current = false;
  break;
```

- [ ] **Step 5: Reset ready state on game_start**

In the existing `game_start` case, add after `gameOverProcessedRef.current = false;`:

```typescript
setIsReady(false);
setOpponentReady(false);
setPlayAgainRequested(false);
```

- [ ] **Step 6: Add handleReady function**

Add this function after `handleStartGame`:

```typescript
const handleReady = () => {
  if (ws) {
    sendMessage(ws, { type: 'ready' });
  }
};
```

- [ ] **Step 7: Add handlePlayAgain function**

Add this function after `handleReady`:

```typescript
const handlePlayAgain = () => {
  if (ws) {
    sendMessage(ws, { type: 'play_again' });
  }
};
```

- [ ] **Step 8: Update PlayerList usage**

In the JSX, update the `PlayerList` component (around line 293) to pass new props:

```tsx
<PlayerList
  players={players}
  hostId={hostId}
  currentPlayerId={playerId}
  gameStatus={gameState}
  onStartGame={handleStartGame}
  onReady={handleReady}
  isReady={isReady}
  opponentReady={opponentReady}
  isRoomFull={isRoomFull}
/>
```

- [ ] **Step 9: Update Results usage**

In the JSX, update the `Results` component (around line 362) to pass new props:

```tsx
<Results
  results={results}
  winner={winner}
  currentPlayerId={playerId}
  onPlayAgain={handlePlayAgain}
  playAgainRequested={playAgainRequested}
/>
```

- [ ] **Step 10: Add Leave Room button in lobby**

In the lobby state section (around line 304-330), add a Leave Room button after the Copy Link button:

```tsx
<button
  onClick={() => router.push('/')}
  className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-medium transition-colors"
>
  Leave Room
</button>
```

- [ ] **Step 11: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 12: Run client tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 13: Commit**

```bash
git add client/src/app/room/\[id\]/page.tsx
git commit -m "feat: integrate ready and play again flow into room page"
```

---

### Task 11: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run Go tests**

Run: `cd server && go test ./...`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript type check**

Run: `cd client && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `cd client && npm run lint`
Expected: No errors

- [ ] **Step 4: Run client tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 5: Manual verification checklist**

- [ ] Host sees "Start Game" button in lobby
- [ ] Guest sees waiting message until host clicks Start
- [ ] After host clicks Start, guest sees "Ready" button
- [ ] After guest clicks Ready, game starts with countdown
- [ ] After game finishes, both see Results with "Play Again" button
- [ ] When one clicks Play Again, other sees toast notification
- [ ] When both click Play Again, both return to lobby
- [ ] "Leave Room" button appears in lobby and navigates to home
- [ ] Ready status badges show next to player names
- [ ] WebSocket stays connected throughout the flow
