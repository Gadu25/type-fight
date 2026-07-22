# Typing VS Game — Design Spec

## Overview

A real-time multiplayer typing competition. Players create rooms, share invite links, and race to type the same text. Tracks WPM, accuracy, winrate, and match history.

## Goals

- v1: 1v1 matches with room invite links, match history, and winrate
- Future: group matches (2v2, FFA), spectator mode, user auth, Postgres

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js (React) | Familiar from existing projects, free hosting on Vercel |
| Backend | Go + gorilla/websocket | Fast, great WebSocket support, efficient on free tier |
| Database | SQLite (v1) | Zero config, single file, easy to swap via interface |
| Hosting | Vercel (frontend) + Railway (backend) | Free tier for both |

## Architecture

```
┌─────────────────┐      WebSocket       ┌──────────────────┐
│   Next.js UI    │◄────────────────────►│   Go Backend      │
│  (Vercel free)  │      REST API        │  (Railway free)   │
└─────────────────┘                      └────────┬─────────┘
                                                  │
                                         ┌────────▼─────────┐
                                         │     SQLite       │
                                         │  (local file)    │
                                         └──────────────────┘
```

## Backend Structure

```
server/
├── cmd/
│   └── main.go              # entry point
├── internal/
│   ├── config/              # env vars, feature flags
│   ├── game/
│   │   ├── engine.go        # pure game logic (no network deps)
│   │   ├── room.go          # room lifecycle
│   │   └── words.go         # text pools
│   ├── store/
│   │   ├── sqlite.go        # v1: SQLite implementation
│   │   └── store.go         # Store interface (swap to Postgres later)
│   ├── ws/
│   │   ├── hub.go           # connection manager
│   │   ├── handler.go       # websocket message routing
│   │   └── protocol.go      # typed message structs
│   └── api/
│       ├── routes.go        # REST endpoints
│       └── middleware.go     # CORS, logging
├── go.mod
├── go.sum
└── Makefile
```

## Data Model (SQLite v1)

```sql
CREATE TABLE players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    text_content TEXT NOT NULL,
    started_at DATETIME,
    ended_at DATETIME
);

CREATE TABLE match_players (
    match_id TEXT,
    player_id TEXT,
    wpm REAL,
    accuracy REAL,
    finished_at DATETIME,
    PRIMARY KEY (match_id, player_id)
);
```

**Winrate is computed, not stored:**
```sql
SELECT
    COUNT(CASE WHEN mp.finished_at = (
        SELECT MIN(finished_at) FROM match_players WHERE match_id = mp.match_id
    ) THEN 1 END) * 100.0 / COUNT(*)
FROM match_players mp
WHERE mp.player_id = ?;
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/rooms | Create a room, returns room_id + join_url |
| GET | /api/rooms/:id | Get room state (players, status) |
| GET | /api/players/:id/stats | Get player stats (winrate, total matches) |
| GET | /api/players/:id/history | Get match history |
| WS | /ws/room/:id | Real-time game events |

## Game Mechanics

- **WPM:** `correct_characters / 5 / (elapsed_time_minutes)` — standard formula
- **Accuracy:** `correct_keystrokes / total_keystrokes * 100`
- **Win condition:** First player to finish the text, OR highest accuracy at time limit (30s default)
- **Tiebreaker:** Higher accuracy wins; if still tied, both players win

## WebSocket Protocol

### Client → Server
```json
{ "type": "join", "player_name": "Alex" }
{ "type": "keystroke", "char": "a", "position": 5 }
{ "type": "ready" }
{ "type": "start_game" }  // host only
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

## Room & Invite Flow

1. Player clicks "Create Room" → `POST /api/rooms`
2. Gets back `{ room_id: "abc123" }`
3. Shareable URL: `https://yourdomain.com/room/abc123`
4. Other players visit the URL → join via WebSocket
5. Host clicks "Start" → game begins for all players

## Frontend Pages

| Route | Page |
|-------|------|
| `/` | Home — enter name, create/join room |
| `/room/[id]` | Game room — waiting lobby + game view |
| `/profile/[id]` | Player profile — stats, match history |

## Future Upgrade Paths

| v1 (now) | Future |
|-----------|--------|
| SQLite file | Postgres on VPS |
| Single Go server | Horizontal scale with Redis pub/sub for room state |
| Guest names | OAuth/Google login |
| 1v1 only | Group matches (room.players[] already supports N) |
| No spectator | Spectator WebSocket channel |
| Fixed text pool | User-submitted text, external API sources |
