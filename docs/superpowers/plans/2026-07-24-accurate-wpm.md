# Accurate WPM Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix WPM calculation to use each player's first keystroke time instead of game start time, eliminating countdown-induced deflation.

**Architecture:** Add `FirstKeystrokeTime` to `PlayerState`, record it on first keystroke, use it in all WPM calculations with fallback to `StartTime`.

**Tech Stack:** Go 1.22, standard library `time` package

## Global Constraints

- Go backend only — no client changes
- Follow existing code patterns in `server/internal/game/`
- Existing unit tests must pass
- New test cases for the fix

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `server/internal/game/room.go` | Modify | Add field, record on first keystroke, use in WPM calls |
| `server/internal/game/engine_test.go` | Modify | Add test for first-keystroke WPM |

---

### Task 1: Fix WPM Calculation

**Files:**
- Modify: `server/internal/game/room.go`
- Modify: `server/internal/game/engine_test.go`

**Interfaces:**
- Consumes: `CalculateWPM(correctChars int, elapsed time.Duration) float64` (unchanged)
- Produces: Accurate WPM using first-keystroke time

- [ ] **Step 1: Add `FirstKeystrokeTime` to `PlayerState` struct**

In `server/internal/game/room.go`, add the field to the struct (after `FinishTime`):

```go
type PlayerState struct {
    ID               string
    Name             string
    Position         int
    Finished         bool
    StartTime        time.Time
    FinishTime       time.Time
    FirstKeystrokeTime time.Time
}
```

- [ ] **Step 2: Record first keystroke time in `UpdatePlayerPosition`**

In `server/internal/game/room.go`, in the `UpdatePlayerPosition` method, add before the elapsed calculation:

```go
func (rm *RoomManager) UpdatePlayerPosition(roomID, playerID string, position int) (float64, error) {
    rm.mu.RLock()
    room, exists := rm.rooms[roomID]
    rm.mu.RUnlock()
    if !exists {
        return 0, fmt.Errorf("room not found")
    }

    player, exists := room.Players[playerID]
    if !exists {
        return 0, fmt.Errorf("player not found")
    }

    player.Position = position

    // Record first keystroke time
    if player.FirstKeystrokeTime.IsZero() && position > 0 {
        player.FirstKeystrokeTime = time.Now()
    }

    // Use first keystroke time for WPM, fallback to start time
    startTime := player.StartTime
    if !player.FirstKeystrokeTime.IsZero() {
        startTime = player.FirstKeystrokeTime
    }
    elapsed := time.Since(startTime)
    wpm := CalculateWPM(position, elapsed)

    if !player.Finished && position >= len(room.Text) {
        player.Finished = true
        player.FinishTime = time.Now()
    }

    return wpm, nil
}
```

- [ ] **Step 3: Update final WPM in `CheckGameCompletion`**

In `server/internal/game/room.go`, in the `CheckGameCompletion` method, update the elapsed time calculation:

```go
for _, p := range room.Players {
    // Use first keystroke time for WPM, fallback to start time
    startTime := p.StartTime
    if !p.FirstKeystrokeTime.IsZero() {
        startTime = p.FirstKeystrokeTime
    }

    elapsed := time.Since(startTime)
    if p.Finished {
        elapsed = p.FinishTime.Sub(startTime)
    }
    wpm := CalculateWPM(p.Position, elapsed)
    accuracy := CalculateAccuracy(p.Position, len(room.Text))

    results = append(results, GameOverResult{
        PlayerID: p.ID,
        Name:     p.Name,
        WPM:      wpm,
        Accuracy: accuracy,
        Position: p.Position,
        Finished: p.Finished,
    })
}
```

- [ ] **Step 4: Add test case for first-keystroke WPM**

In `server/internal/game/engine_test.go`, add a test case:

```go
{"50 chars finished in 15s with 4s countdown offset", 50, 15 * time.Second, 40.0},
```

This verifies that when elapsed = 15s (after subtracting countdown), WPM = 50/5/(15/60) = 40.0.

Also add a test for the edge case where first keystroke time is zero:

```go
{"zero elapsed returns 0", 10, 0, 0},
```

- [ ] **Step 5: Run tests**

Run: `cd /home/alexanderudag/dev/type-fight/server && go test ./...`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/internal/game/room.go server/internal/game/engine_test.go
git commit -m "fix: use first keystroke time for accurate WPM calculation"
```
