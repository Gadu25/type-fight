# Game Loop Redesign

## Overview

Redesign the game loop to support multi-game sessions within a single room. Players can ready up, play multiple games, and use a request/accept flow for "Play Again" instead of navigating away.

## Current State

- No ready system (`handleReady` is a no-op)
- "Play Again" navigates to home page (destroys WebSocket)
- No room reset — once "finished", room stays finished forever
- Single game per room architecture

## New Game Flow

```
Lobby → Ready Up → Game → Results → Play Again Request → Lobby → Ready Up → ...
```

### Detailed Flow

1. **Lobby**: Host sees "Start Game" button, guest sees waiting message
2. **Ready**: Host clicks "Start Game" → server marks host ready → guest sees "Your opponent is ready" toast and "Ready" button
3. **Game Start**: Guest clicks "Ready" → server starts game → countdown → playing
4. **Game End**: Results shown with "Play Again" button (stays in room)
5. **Play Again**: Player A clicks "Play Again" → Player B sees "Your opponent requests to play again" toast
6. **Return to Lobby**: Player B clicks "Play Again" → room resets → both return to lobby
7. **Repeat**: Players can ready up and play again

### Leave Room

- "Leave Room" button shown in lobby state (before first game and after returning to lobby)
- Clicking it navigates to home page
- If a player disconnects, other player sees "Opponent disconnected" toast

## Server-Side Changes

### Player State (`room.go`)

Add fields to `PlayerState`:

```go
type PlayerState struct {
    // ... existing fields ...
    Ready         bool
    WantsPlayAgain bool
}
```

### Room State (`room.go`)

Add `"lobby"` status for post-game waiting:

```go
// Status values: "waiting", "lobby", "playing", "finished"
```

- `"waiting"` — Initial state when room is created
- `"lobby"` — Post-game state, players can ready up again
- `"playing"` — Game in progress
- `"finished"` — Game over, waiting for play again decisions

### New Message Types (`protocol.go`)

**Client → Server:**
- `ready` — Player signals readiness
- `play_again` — Player signals they want to play again

**Server → Client:**
- `player_ready` — `{ ready_player_id: string }` — broadcasts who is ready
- `play_again_request` — `{ opponent_name: string }` — notifies client their opponent wants to play again
- `return_to_lobby` — tells both clients to return to lobby view

### Room Reset (`room.go`)

New function `ResetRoom(roomID string)`:

```go
func (rm *RoomManager) ResetRoom(roomID string) error {
    // Lock room
    // Clear game state: Text, GameStart, results
    // Reset each player: Position, Finished, FinishTime, FirstKeystrokeTime, Ready, WantsPlayAgain
    // Set Status = "lobby"
    // Unlock room
}
```

### Handler Changes (`handler.go`)

**`handleReady`** (currently no-op):
- Mark player as `Ready = true`
- Broadcast `player_ready` to room
- If both players ready AND room status is `"lobby"` or `"waiting"`:
  - Call `StartGame` (or inline the logic)
  - Broadcast `game_start`

**`handlePlayAgain`** (new):
- Mark player as `WantsPlayAgain = true`
- Send `play_again_request` to opponent only
- If both players want to play again:
  - Call `ResetRoom`
  - Broadcast `return_to_lobby` to both

## Client-Side Changes

### Room Page (`page.tsx`)

**New state variables:**
```typescript
const [isReady, setIsReady] = useState(false);
const [opponentReady, setOpponentReady] = useState(false);
const [playAgainRequested, setPlayAgainRequested] = useState(false);
```

**New message handlers:**
- `player_ready` — Update `opponentReady` if from opponent, `isReady` if from self
- `play_again_request` — Show toast, set `playAgainRequested`
- `return_to_lobby` — Reset game state, set `gameState` to `'lobby'`, clear `isReady`/`opponentReady`

**Modified handlers:**
- `game_start` — Reset `isReady`/`opponentReady`/`playAgainRequested`
- `game_over` — No changes (already works)

### PlayerList Component (`PlayerList.tsx`)

**Modified props:**
- `isReady: boolean` — whether current player is ready
- `opponentReady: boolean` — whether opponent is ready
- `gameStatus: string` — current game state

**Modified UI:**
- Host: "Start Game" button → on click, sends `ready` message, shows "Waiting for opponent..."
- Guest: After host ready, shows "Ready" button → on click, sends `ready` message
- Show ready status badges next to player names

### Results Component (`Results.tsx`)

**Modified props:**
- `onPlayAgain: () => void` — callback instead of navigation
- `playAgainRequested: boolean` — whether opponent requested

**Modified UI:**
- "Play Again" button calls `onPlayAgain` instead of `router.push('/')`
- When `playAgainRequested` is true, show "Your opponent wants to play again" and highlight button

### New Leave Button

Add to lobby state in room page:
- "Leave Room" button that calls `router.push('/')`
- Only shown when `gameState === 'lobby'`

## State Transitions

```
lobby --[host clicks Start]--> lobby (host ready)
lobby --[guest clicks Ready]--> countdown
countdown --[timer]--> playing
playing --[game_over]--> finished
finished --[both click Play Again]--> lobby
lobby --[Leave Room]--> home (navigate away)
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `server/internal/game/room.go` | Modify | Add Ready/WantsPlayAgain fields, ResetRoom function, "lobby" status |
| `server/internal/ws/protocol.go` | Modify | Add new message types |
| `server/internal/ws/handler.go` | Modify | Implement handleReady, handlePlayAgain |
| `client/src/lib/ws.ts` | Modify | Add new message types to TypeScript definitions |
| `client/src/app/room/[id]/page.tsx` | Modify | Add ready/play again state and handlers |
| `client/src/components/PlayerList.tsx` | Modify | Add ready UI |
| `client/src/components/Results.tsx` | Modify | Change Play Again to in-room flow |
