# Accurate WPM Calculation Design

## Problem

`StartTime` is set when the server processes `start_game`, but the client has a 4-second countdown before typing begins. WPM is deflated by ~4 seconds for every player because the elapsed time includes countdown dead time.

## Solution

Track each player's first keystroke time and use it for WPM calculations instead of the game start time.

## Changes

### Server — `room.go`

1. Add `FirstKeystrokeTime time.Time` field to `PlayerState` struct
2. In `UpdatePlayerPosition`: on first keystroke (when `FirstKeystrokeTime` is zero), record `time.Now()`
3. In all `CalculateWPM` calls: use `FirstKeystrokeTime` instead of `StartTime` when available, fallback to `StartTime` if zero

### Server — `engine_test.go`

- Add test case verifying WPM with first-keystroke time offset

### No changes needed

- `engine.go` — formula unchanged
- Client — displays server-computed WPM

## WPM Formula (unchanged)

```
WPM = correctChars / 5 / (elapsedMinutes)
```

Where `elapsedMinutes = (finishOrNow - firstKeystroke) / 60`

## Edge Cases

- Player never types: fallback to `StartTime`, WPM = 0
- Player types 1 char then stops: elapsed counts from first keystroke
- Both players finish: each uses own `FirstKeystrokeTime` for fair comparison
