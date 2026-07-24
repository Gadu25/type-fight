# Room Capacity Limit UX Design

## Overview
Improve the user experience when a player tries to join a room that's already full (2 players max).

## Problem
Currently, when a user tries to join a full room, the server sends an error message but the client only logs it to console. Users receive no visual feedback.

## Solution

### 1. Show Error as Toast
- When the server sends a "room is full" error, display it using the existing Toast component
- Error message: "This room is full. Only 2 players are allowed per match."

### 2. Show Room Full State
- Add state variable `isRoomFull` to track if the room is at capacity
- When room is full, display a prominent message in the lobby area
- Message: "Room is Full - This match already has 2 players"

### 3. Disable Interactions
- When room is full, disable the "Start Game" button
- Prevent the user from interacting with the room (read-only view)

## Implementation Details

### Files to Modify
- `src/app/room/[id]/page.tsx` - Add error handling and room full state

### Changes
1. Add `isRoomFull` state variable
2. Modify error handler to:
   - Show toast for room full errors
   - Set `isRoomFull` to true
3. Update lobby UI to show room full message when `isRoomFull` is true
4. Disable "Start Game" button when room is full

### Error Message Text
- Toast: "This room is full. Only 2 players are allowed per match."
- Lobby: "Room is Full - This match already has 2 players"

## User Flow
1. User joins room via shared link
2. Room already has 2 players
3. Server rejects join with "room is full" error
4. Client shows toast with error message
5. Client displays "Room is Full" message in lobby
6. User stays on room page in read-only mode

## Dependencies
- Uses existing Toast component
- No server-side changes required (error handling already exists)
