# Live Enemy Progress & Early Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live enemy progress preview and early completion notifications to the typing fight game.

**Architecture:** Client-side tracking of enemy position via existing `progress` messages. New `player_finished` message type for completion notifications. Two new UI components: `EnemyPreview` and `Toast`.

**Tech Stack:** Go (gorilla/websocket), Next.js 15, React, TypeScript, Tailwind CSS

## Global Constraints

- Node 24 required (via nvm)
- Go server on `:8080`, Next.js on `:3000`
- All existing tests must pass after each task
- Follow existing code conventions (no comments unless asked)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `server/internal/ws/protocol.go` | Modify | Add `PlayerFinished` message type |
| `server/internal/ws/handler.go` | Modify | Broadcast `player_finished` on completion |
| `client/src/components/EnemyPreview.tsx` | Create | Mini text preview of enemy progress |
| `client/src/components/Toast.tsx` | Create | Notification banner component |
| `client/src/app/room/[id]/page.tsx` | Modify | Add state, handlers, render new components |

---

### Task 1: Server - Add player_finished message type

**Files:**
- Modify: `server/internal/ws/protocol.go:12-24`

**Interfaces:**
- Consumes: None
- Produces: `ServerMessage.PlayerFinished` field for use in handler

- [ ] **Step 1: Add PlayerFinished field to ServerMessage**

Open `server/internal/ws/protocol.go` and add `PlayerFinished` field:

```go
// Server -> Client messages
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
}
```

- [ ] **Step 2: Run Go tests to verify no regressions**

Run: `cd server && go test ./...`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add server/internal/ws/protocol.go
git commit -m "feat: add player_finished message type to protocol"
```

---

### Task 2: Server - Broadcast player_finished on completion

**Files:**
- Modify: `server/internal/ws/handler.go:150-189`

**Interfaces:**
- Consumes: `ServerMessage.PlayerFinished` from Task 1
- Produces: `player_finished` broadcast to room

- [ ] **Step 1: Add player_finished broadcast to handleKeystroke**

In `server/internal/ws/handler.go`, after the position update and progress broadcast (line ~165), add completion check:

```go
func (h *Handler) handleKeystroke(conn Connection, roomID, playerID string, msg ClientMessage) {
	wpm, err := h.roomManager.UpdatePlayerPosition(roomID, playerID, msg.Position)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	response := ServerMessage{
		Type:     "progress",
		PlayerID: playerID,
		Position: msg.Position,
		WPM:      wpm,
	}

	data, _ := json.Marshal(response)
	h.hub.BroadcastToRoom(roomID, data)

	// Check if player just finished
	room := h.roomManager.GetRoom(roomID)
	if room != nil {
		room.mu.RLock()
		player, exists := room.Players[playerID]
		room.mu.RUnlock()
		
		if exists && player.Finished {
			finishedMsg := ServerMessage{
				Type: "player_finished",
				PlayerFinished: &PlayerInfo{
					ID:   playerID,
					Name: player.Name,
				},
			}
			finishedData, _ := json.Marshal(finishedMsg)
			h.hub.BroadcastToRoom(roomID, finishedData)
		}
	}

	completed, results, winner := h.roomManager.CheckGameCompletion(roomID)
	if completed {
		resultInfos := make([]ResultInfo, len(results))
		for i, r := range results {
			resultInfos[i] = ResultInfo{
				PlayerID: r.PlayerID,
				Name:     r.Name,
				WPM:      r.WPM,
				Accuracy: r.Accuracy,
				Position: r.Position,
			}
		}

		gameOverMsg := ServerMessage{
			Type:    "game_over",
			Results: resultInfos,
			Winner:  winner,
		}

		gameOverData, _ := json.Marshal(gameOverMsg)
		h.hub.BroadcastToRoom(roomID, gameOverData)
	}
}
```

- [ ] **Step 2: Run Go tests**

Run: `cd server && go test ./...`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add server/internal/ws/handler.go
git commit -m "feat: broadcast player_finished when player completes text"
```

---

### Task 3: Client - Create Toast component

**Files:**
- Create: `client/src/components/Toast.tsx`

**Interfaces:**
- Consumes: None
- Produces: `<Toast message onDismiss />` component

- [ ] **Step 1: Create Toast component**

Create `client/src/components/Toast.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, onDismiss, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add fade-in animation to Tailwind config**

Open `client/tailwind.config.ts` and add keyframes:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translate(-50%, -10px)" },
          "100%": { opacity: "1", transform: "translate(-50%, 0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 3: Run frontend tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 4: Run build**

Run: `cd client && source ~/.nvm/nvm.sh && nvm use 24 && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Toast.tsx client/tailwind.config.ts
git commit -m "feat: add Toast notification component"
```

---

### Task 4: Client - Create EnemyPreview component

**Files:**
- Create: `client/src/components/EnemyPreview.tsx`

**Interfaces:**
- Consumes: `text: string`, `enemyPosition: number`, `enemyName: string`
- Produces: `<EnemyPreview />` component

- [ ] **Step 1: Create EnemyPreview component**

Create `client/src/components/EnemyPreview.tsx`:

```tsx
'use client';

interface EnemyPreviewProps {
  text: string;
  enemyPosition: number;
  enemyName: string;
}

export default function EnemyPreview({ text, enemyPosition, enemyName }: EnemyPreviewProps) {
  const renderText = () => {
    return text.split('').map((char, index) => {
      let className = 'text-gray-600';

      if (index < enemyPosition) {
        className = 'text-orange-400';
      } else if (index === enemyPosition) {
        className = 'text-orange-300 bg-orange-900/30';
      }

      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div>
        <span className="text-sm font-medium text-orange-400">Enemy - {enemyName}</span>
        <span className="text-xs text-gray-500 ml-auto">
          {Math.round((enemyPosition / text.length) * 100)}%
        </span>
      </div>
      <div className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
        {renderText()}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run frontend tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `cd client && source ~/.nvm/nvm.sh && nvm use 24 && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add client/src/components/EnemyPreview.tsx
git commit -m "feat: add EnemyPreview component for live progress"
```

---

### Task 5: Client - Integrate features into room page

**Files:**
- Modify: `client/src/app/room/[id]/page.tsx`

**Interfaces:**
- Consumes: `EnemyPreview` from Task 4, `Toast` from Task 3, `player_finished` message from Task 2
- Produces: Complete integration of both features

- [ ] **Step 1: Add imports and state variables**

In `client/src/app/room/[id]/page.tsx`, add imports and state:

```tsx
import EnemyPreview from '@/components/EnemyPreview';
import Toast from '@/components/Toast';

// Add inside RoomPage component, after existing state:
const [enemyPosition, setEnemyPosition] = useState(0);
const [enemyName, setEnemyName] = useState('');
const [enemyFinished, setEnemyFinished] = useState(false);
const [toastMessage, setToastMessage] = useState<string | null>(null);
```

- [ ] **Step 2: Add player_finished message handler**

In the `handleMessage` callback, add case for `player_finished`:

```tsx
case 'player_finished':
  if (message.player_finished) {
    setEnemyFinished(true);
    setToastMessage(`${message.player_finished.name} finished the text!`);
  }
  break;
```

- [ ] **Step 3: Update progress handler to track enemy**

Modify the existing `progress` case to track enemy position:

```tsx
case 'progress':
  if (message.player_id === playerId) {
    setCurrentPosition(message.position || 0);
  } else {
    setEnemyPosition(message.position || 0);
    // Set enemy name from players list if not set
    if (!enemyName && message.player_id) {
      const enemy = players.find(p => p.id === message.player_id);
      if (enemy) setEnemyName(enemy.name);
    }
  }
  break;
```

- [ ] **Step 4: Add EnemyPreview to layout**

In the return JSX, add EnemyPreview above the TypingArea in the playing state:

```tsx
{gameState === 'playing' && (
  <div className="space-y-4">
    {enemyName && (
      <EnemyPreview
        text={text}
        enemyPosition={enemyPosition}
        enemyName={enemyName}
      />
    )}
    <TypingArea
      text={text}
      onKeystroke={handleKeystroke}
      isActive={true}
      currentPosition={currentPosition}
    />
  </div>
)}
```

- [ ] **Step 5: Add Toast rendering**

At the end of the return JSX (before closing `</main>`), add Toast:

```tsx
{toastMessage && (
  <Toast
    message={toastMessage}
    onDismiss={() => setToastMessage(null)}
  />
)}
```

- [ ] **Step 6: Reset state on game start**

In the `game_start` handler, reset enemy state:

```tsx
case 'game_start':
  if (message.text && message.players) {
    setText(message.text);
    setPlayers(message.players);
    setGameState('playing');
    setCurrentPosition(0);
    setTimeLeft(GAME_TIME_LIMIT);
    setEnemyPosition(0);
    setEnemyFinished(false);
    setToastMessage(null);

    // Find enemy name
    const enemy = message.players.find(p => p.id !== playerId);
    if (enemy) setEnemyName(enemy.name);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }
  break;
```

- [ ] **Step 7: Run frontend tests**

Run: `cd client && npm test`
Expected: All tests pass

- [ ] **Step 8: Run build**

Run: `cd client && source ~/.nvm/nvm.sh && nvm use 24 && npm run build`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add client/src/app/room/\[id\]/page.tsx
git commit -m "feat: integrate enemy preview and completion notification"
```

---

### Task 6: Integration Test - Full flow verification

**Files:**
- None (manual testing)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working feature

- [ ] **Step 1: Start both servers**

Terminal 1: `cd server && go run ./cmd/`
Terminal 2: `cd client && source ~/.nvm/nvm.sh && nvm use 24 && npm run dev`

- [ ] **Step 2: Test enemy preview**

1. Open browser 1 → Create room → Note room code
2. Open browser 2 → Join room with code
3. Both click "Start Game"
4. Type in browser 1 → Verify orange progress appears in browser 2
5. Type in browser 2 → Verify orange progress appears in browser 1

- [ ] **Step 3: Test completion notification**

1. In one browser, type the full text to completion
2. Verify toast notification appears in the other browser
3. Verify timer continues running
4. Verify game ends when both finish or at 30s timeout

- [ ] **Step 4: Run all tests**

```bash
cd server && go test ./...
cd client && npm test
```

Expected: All tests pass

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration test adjustments"
```
