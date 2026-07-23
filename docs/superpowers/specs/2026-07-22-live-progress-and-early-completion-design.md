# Live Enemy Progress & Early Completion

## Overview

Enhance the typing fight experience with two features:
1. **Live enemy progress preview** - Mini text showing opponent's position in real-time
2. **Early completion notification** - Toast when enemy finishes, game ends when both complete or timeout

## Requirements

### Enemy Progress Preview
- Show a miniaturized version of the typing text with enemy's position marked
- Update in real-time as enemy types (uses existing `progress` messages)
- Positioned above the player's own typing area
- Distinct color for enemy's completed characters (orange/yellow vs player's green)

### Early Completion Notification
- When a player finishes typing, broadcast `player_finished` to the room
- Show toast notification: "{name} finished the text!"
- Toast auto-dismisses after 5 seconds
- Timer continues running (game ends at 30s or when both finish)
- No changes to existing `CheckGameCompletion` logic

## Architecture

### Data Flow

```
Keystroke → Server updates position → Broadcasts progress to all
                                          ↓
                              Client tracks enemyPosition
                                          ↓
                              EnemyPreview renders mini text
```

```
Player finishes → Server broadcasts player_finished
                          ↓
                  Client shows toast notification
```

### Components

#### EnemyPreview.tsx (new)
- Props: `text: string`, `enemyPosition: number`, `enemyName: string`
- Renders mini text with orange highlighting for completed chars
- Cursor indicator at enemy's current position
- Header: "Enemy - {name}"

#### Toast.tsx (new)
- Props: `message: string`, `onDismiss: () => void`
- Auto-dismiss after 5 seconds
- Fixed position at top-center of screen
- Green background, white text

### Server Changes

#### protocol.go
- Add `PlayerFinished` message type to ServerMessage

#### handler.go
- In `handleKeystroke`: after updating position, check if finished
- If finished, broadcast `player_finished` to room

### Client Changes

#### room/page.tsx
- New state: `enemyPosition`, `enemyFinished`, `toastMessage`
- Handle `progress` messages to track enemy position
- Handle `player_finished` to show toast
- Render `EnemyPreview` above `TypingArea`

## File Changes

| File | Change |
|------|--------|
| `server/internal/ws/protocol.go` | Add `PlayerFinished` to ServerMessage |
| `server/internal/ws/handler.go` | Broadcast `player_finished` on completion |
| `client/src/components/EnemyPreview.tsx` | New component - mini text preview |
| `client/src/components/Toast.tsx` | New component - notification banner |
| `client/src/app/room/[id]/page.tsx` | Add state, handlers, render new components |

## Testing

1. Manual test: Create room, join with 2 players, verify enemy preview updates
2. Manual test: Have one player finish, verify toast appears for other player
3. Manual test: Verify game ends when both finish or at 30s timeout
4. Run existing tests to ensure no regressions
