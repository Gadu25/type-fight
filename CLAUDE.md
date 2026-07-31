# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Type Fight is a real-time multiplayer typing game where players engage in combat by typing phrases. The project uses a **Go backend** (WebSocket server, game logic) and a **Next.js frontend** (React client, UI).

## Project Structure

```
type-fight/
├── client/                 # Next.js 15 frontend
│   ├── src/
│   │   ├── app/           # App router structure
│   │   │   ├── page.tsx   # Home/lobby (create/join room)
│   │   │   └── room/[id]/ # Battle arena (main game page)
│   │   ├── components/    # 18 React components (HealthBar, TypingArea, etc.)
│   │   └── lib/           # Utilities (WebSocket, account mgmt, word pools)
│   ├── package.json       # Next.js, React 19, Tailwind CSS
│   └── vitest.config.ts   # Vitest for unit tests
│
├── server/                # Go 1.22 backend
│   ├── cmd/main.go        # Entry point (HTTP server, WebSocket handler)
│   ├── internal/
│   │   ├── api/           # HTTP routes (/api/rooms, /ws/room)
│   │   ├── game/          # Game engine (rooms, player state, attack logic)
│   │   ├── ws/            # WebSocket protocol, message handler, hub
│   │   └── integration/   # Integration tests
│   ├── Makefile           # build, run, dev targets
│   └── go.mod             # Go module (gorilla/websocket dependency)
│
└── docs/superpowers/      # Feature planning & design specs
    ├── plans/             # Implementation checklists
    └── specs/             # Technical design documents
```

## Tech Stack

**Client:**
- Next.js 15 (App Router, SSR)
- React 19 with TypeScript 5
- Tailwind CSS 4 + PostCSS
- Vitest + Testing Library (unit tests)
- ESLint 9 + Prettier

**Server:**
- Go 1.22
- gorilla/websocket v1.5.3
- sync.RWMutex for room state
- HTTP 1.1 with net/http

## Key Commands

### Client
```bash
cd client
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Build for production
npm run test       # Run unit tests
npm run lint       # Lint with ESLint
```

### Server
```bash
cd server
make dev          # Run with `go run cmd/main.go`
make build        # Compile to bin/server
make run          # Build and run
go test ./...     # Run all tests
```

## Architecture & Flow

### 1. **Lobby (Home Page)**
- User enters name, creates or joins a room via HTTP POST `/api/rooms`
- Server generates room ID and player ID, stored in localStorage

### 2. **WebSocket Connection**
- Client connects to `ws://localhost:8080/ws/room/{roomID}?player_id={playerID}`
- WebSocket handler registers client in the hub, adds player to room

### 3. **Game States**
- **Lobby:** Players join, ready up
- **Countdown:** 3-second countdown before game starts
- **Playing (Typing):** 30 seconds to type the phrase, select attacks
- **Battle:** Multi-round combat with HP-based elimination (120s time limit)
- **Finished:** Results shown, play-again option

### 4. **Combat Mechanics**
- **Attack tiers** (quick, normal, heavy, ultimate) with word count requirements
- **Damage calculation:** base damage × accuracy (e.g., quick: 80 damage × 0.8 accuracy = 64)
- **WPM & Accuracy:** calculated client-side, sent with `attack_complete`
- **HP system:** Players start with 1000 HP, defeated at 0 HP
- **Opponent visibility:** Real-time attack tier display with colored badges (⚡🛡️💥)

### 5. **Message Protocol**
**Client → Server:**
- `join`: register player name
- `ready`: mark player ready
- `start_game`: host starts game
- `attack_complete`: submit typing result (WPM, accuracy)
- `select_attack` / `switch_attack`: choose attack tier
- `play_again`: request rematch

**Server → Client:**
- `player_list`: initial lobby state
- `game_start`: game begins, phrase sent
- `game_setup`: phrase pools for client-side generation
- `hp_update`: damage applied, new HP
- `opponent_attack`: opponent's chosen tier
- `game_over`: winner, final results
- `battle_over`: combat round finished

## Key Modules

### Server: Game Engine (`server/internal/game/`)
- **room.go:** Room & PlayerState management, attack selection
- **engine.go:** Combat logic (damage calc, WPM, accuracy, winner determination)
- **words.go:** Phrase pool management

**Key constants:**
- Game time: 30 seconds, Battle time: 120 seconds
- Base HP: 1000
- Attack damages: quick(80), normal(180), heavy(350), ultimate(600)

### Client: WebSocket Utilities (`client/src/lib/ws.ts`)
- Type-safe message protocol (TypeScript unions)
- `createWebSocket()`: establish connection with callbacks
- `sendMessage()`: safe message sending with connection state check

### Client: Game Page (`client/src/app/room/[id]/page.tsx`)
- Largest component: 600+ lines
- Manages all game state (players, HP, combo streak, floating damage)
- Handles message routing, timer logic, floating damage animations

## Testing

### Server Tests
- `server/internal/game/*_test.go`: Room creation, attack logic, WPM calculation
- `server/internal/ws/*_test.go`: Protocol marshaling, message handling, broadcasts

### Client Tests
- Component tests: `BattleTimer.test.tsx`, `HealthBar.test.tsx`, `TypingArea.test.tsx`
- WebSocket tests: `ws.test.ts` (connection, message parsing)
- Run with `npm run test` (Vitest + jsdom environment)

## Environment & Configuration

**Client:**
- `NEXT_PUBLIC_SERVER_URL`: WebSocket server (default: `ws://localhost:8080`)
- `SERVER_URL`: Backend API for rewrites (default: `http://localhost:8080`)
- Path alias: `@/*` → `./src/*`

**Server:**
- `PORT` environment variable (default: 8080)
- CORS enabled for all origins in WebSocket upgrader

## Common Development Tasks

### Add a new message type
1. Add to `ClientMessage` or `ServerMessage` union in `client/src/lib/ws.ts`
2. Handle in `server/internal/ws/protocol.go` (add struct, update `CombatServerMessage`)
3. Add handler in `server/internal/ws/handler.go` (new case in switch)
4. Add case in client page.tsx `handleMessage`

### Add a component
- Create in `client/src/components/ComponentName.tsx`
- Import/use in `client/src/app/room/[id]/page.tsx`
- Add tests as `ComponentName.test.tsx` (Vitest + Testing Library)

### Modify game rules
- Attack tiers & damage: `server/internal/game/engine.go` (attackDefs map)
- Time limits: GameTimeLimit, BattleTimeLimit constants
- Client reflects same values in `client/src/app/room/[id]/page.tsx`

### Debug WebSocket flow
- Server logs: `log.Printf()` in handler.go
- Client console: browser DevTools → Network → WS messages
- Check message types and payloads in both `ws.ts` protocol and server protocol.go

## Deployment

- **Vercel:** Client auto-deploys from main branch
- **Railway:** Server deployed via `railway.toml` configuration

## Concurrency Note

Server hub broadcasts use goroutines + channels. Never hold a write lock (`sync.RWMutex`) during external calls or channel sends — deadlock risk in room state management.
