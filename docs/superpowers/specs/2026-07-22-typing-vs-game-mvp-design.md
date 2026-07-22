# Typing VS Game — MVP Design Spec

## Overview

A real-time 1v1 multiplayer typing competition. Two players create/join rooms via shareable links, race to type the same text, and see results with WPM and accuracy.

## MVP Scope

**In scope:**
- Room creation and joining (2 players max)
- Real-time typing race via WebSocket
- WPM and accuracy calculation
- Winner determination
- Results display

**Out of scope (designed for future):**
- Database persistence (Store interface ready)
- Group matches (room data model supports N players)
- Spectator mode (protocol extensible)
- User auth (player identified by name only)
- Match history (comes with database)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js (React) + Tailwind | Fast development, free hosting on Vercel |
| Backend | Go + gorilla/websocket | Fast, great WebSocket support, efficient on free tier |
| Node | 24 (via nvm) | Latest LTS |
| Database | None (MVP) | In-memory state only, designed for future SQLite/Postgres |
| Hosting | Vercel (frontend) + Railway (backend) | Free tier for both |

## Architecture

```
┌─────────────────┐      WebSocket       ┌──────────────────┐
│   Next.js UI    │◄────────────────────►│   Go Backend      │
│  (Vercel free)  │      REST API        │  (Railway free)   │
└─────────────────┘                      └──────────────────┘
```

No database for MVP — all state lives in memory on the Go server.

## Project Structure

```
type-fight/
├── client/                    # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Home — enter name, create/join room
│   │   │   └── room/[id]/
│   │   │       └── page.tsx   # Game room — lobby + typing race
│   │   ├── components/
│   │   │   ├── TypingArea.tsx  # Text display + input handling
│   │   │   ├── PlayerList.tsx  # Shows connected players
│   │   │   └── Results.tsx     # WPM, accuracy, winner
│   │   └── lib/
│   │       └── ws.ts          # WebSocket client helper
│   └── package.json
├── server/                    # Go backend
│   ├── cmd/main.go            # Entry point
│   ├── internal/
│   │   ├── game/
│   │   │   ├── engine.go      # Game logic (WPM, accuracy, win check)
│   │   │   ├── room.go        # Room lifecycle
│   │   │   └── words.go       # Text pool
│   │   └── ws/
│   │       ├── hub.go         # Connection manager
│   │       ├── handler.go     # Message routing
│   │       └── protocol.go    # Typed message structs
│   ├── go.mod
│   └── Makefile
├── docs/
└── README.md
```

## Backend Structure

### Game Engine (`internal/game/engine.go`)
Pure game logic with no network dependencies:
- Calculate WPM: `correct_characters / 5 / (elapsed_time_minutes)`
- Calculate accuracy: `correct_keystrokes / total_keystrokes * 100`
- Check win condition: first to finish OR highest accuracy at 30s time limit
- Tiebreaker: higher accuracy wins; if still tied, both players win

### Room Manager (`internal/game/room.go`)
Room lifecycle management:
- Create room with unique ID
- Join room (max 2 players for MVP, but data model supports N)
- Start game (host only)
- Track game state per room

### Word Pool (`internal/game/words.go`)
- ~20 hardcoded sentences for MVP
- Random selection when game starts
- Easy to extend with external sources later

### WebSocket Hub (`internal/ws/hub.go`)
Connection manager:
- Track active connections per room
- Broadcast messages to all players in a room
- Handle player disconnections

### Protocol (`internal/ws/protocol.go`)
Typed message structs for type-safe communication:
- Client → Server: join, ready, start_game, keystroke
- Server → Client: player_joined, game_start, progress, player_finished, game_over, error

## WebSocket Protocol

### Client → Server
```json
{ "type": "join", "player_name": "Alex" }
{ "type": "ready" }
{ "type": "start_game" }
{ "type": "keystroke", "char": "a", "position": 5 }
```

### Server → Client
```json
{ "type": "player_joined", "player": { "id": "...", "name": "Alex" } }
{ "type": "game_start", "text": "the typing text...", "players": [...] }
{ "type": "progress", "player_id": "...", "position": 12, "wpm": 45.2 }
{ "type": "player_finished", "player_id": "...", "wpm": 62.1, "accuracy": 98.5 }
{ "type": "game_over", "winner": "...", "results": [...] }
{ "type": "error", "message": "Room is full" }
```

**Scaling note:** Protocol uses `type` field pattern — new message types can be added without breaking existing clients.

## Frontend Pages

| Route | Page | Components |
|-------|------|------------|
| `/` | Home — enter name, create/join room | Name input, Create Room button, Join Room input |
| `/room/[id]` | Game room — lobby → typing race → results | PlayerList, TypingArea, Results |

### Components

**TypingArea.tsx**
- Displays target text with character-by-character highlighting
- Green for correct, red for incorrect, gray for upcoming
- Captures keystrokes and sends to server
- Shows real-time WPM

**PlayerList.tsx**
- Shows connected players and their ready status
- Host indicator
- "Start Game" button (host only, when both ready)

**Results.tsx**
- Final WPM and accuracy for both players
- Winner announcement
- "Play Again" button (creates a new room, since rooms are cleared after game ends)

## Game Flow

1. Player A visits `/`, enters name, clicks "Create Room"
2. Gets redirect to `/room/abc123` with shareable link
3. Player B visits link, enters name, joins via WebSocket
4. Both see each other in lobby via PlayerList
5. Both mark as ready
6. Player A (host) clicks "Start Game"
7. Server sends `game_start` with random text to both
8. TypingArea activates — both players type
9. Keystrokes sent to server, progress broadcast to both
10. First to finish triggers `player_finished`
11. After finish or 30s timeout, `game_over` sent
12. Results component shows final stats

## Scaling Considerations

The MVP is designed with clear interfaces for future expansion:

| Component | MVP | Future |
|-----------|-----|--------|
| Room capacity | 2 players | N players (data model already supports) |
| State storage | In-memory | SQLite → Postgres (via Store interface) |
| WebSocket protocol | Basic messages | Extensible with new types |
| Game engine | Pure logic | Easy to test and extend |
| Text source | Hardcoded pool | User-submitted, API sources |

## API Endpoints (MVP)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/rooms | Create a room, returns room_id |
| GET | /api/rooms/:id | Get room state (players, status) |
| WS | /ws/room/:id | Real-time game events |

## Success Criteria

- Two players can create/join a room via shareable link
- Both players see the same text and type simultaneously
- Real-time progress is shared (position, WPM)
- Winner is correctly determined (first finish or accuracy at timeout)
- Results show accurate WPM and accuracy for both players
- UI is responsive and typing experience is smooth
