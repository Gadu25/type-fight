package game

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type PlayerState struct {
	ID         string
	Name       string
	Position   int
	Correct    int
	Total      int
	StartTime  time.Time
	Finished   bool
	FinishTime time.Time
}

type Room struct {
	ID        string
	Players   map[string]*PlayerState
	HostID    string
	Status    string // "waiting", "playing", "finished"
	Text      string
	GameStart time.Time
	mu        sync.RWMutex
}

type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) CreateRoom(hostID, hostName string) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	
	room := &Room{
		ID:      generateID(),
		Players: make(map[string]*PlayerState),
		HostID:  hostID,
		Status:  "waiting",
	}
	
	room.Players[hostID] = &PlayerState{
		ID:   hostID,
		Name: hostName,
	}
	
	rm.rooms[room.ID] = room
	return room
}

func (rm *RoomManager) JoinRoom(roomID, playerID, playerName string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	
	room, exists := rm.rooms[roomID]
	if !exists {
		return fmt.Errorf("room not found")
	}
	
	room.mu.Lock()
	defer room.mu.Unlock()
	
	if len(room.Players) >= 2 {
		return fmt.Errorf("room is full")
	}
	
	room.Players[playerID] = &PlayerState{
		ID:   playerID,
		Name: playerName,
	}
	
	return nil
}

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
	
	room.Status = "playing"
	room.Text = GetRandomText()
	room.GameStart = time.Now()
	
	for _, p := range room.Players {
		p.StartTime = room.GameStart
	}
	
	return nil
}

func (rm *RoomManager) GetRoom(roomID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	
	return rm.rooms[roomID]
}

func (rm *RoomManager) UpdatePlayerPosition(roomID, playerID string, position int) (float64, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()
	
	if !exists {
		return 0, fmt.Errorf("room not found")
	}
	
	room.mu.Lock()
	defer room.mu.Unlock()
	
	player, exists := room.Players[playerID]
	if !exists {
		return 0, fmt.Errorf("player not in room")
	}
	
	player.Position = position
	elapsed := time.Since(player.StartTime)
	wpm := CalculateWPM(position, elapsed)
	
	return wpm, nil
}

func (r *Room) GetRoomInfo() RoomInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	infos := make([]PlayerInfo, 0, len(r.Players))
	for _, p := range r.Players {
		infos = append(infos, PlayerInfo{
			ID:   p.ID,
			Name: p.Name,
		})
	}
	return RoomInfo{
		Status:  r.Status,
		Players: infos,
	}
}

type RoomInfo struct {
	Status  string       `json:"status"`
	Players []PlayerInfo `json:"players"`
}

type PlayerInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
