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
	
	if _, exists := room.Players[playerID]; exists {
		room.Players[playerID].Name = playerName
		return nil
	}
	
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

	if !player.Finished && position >= len(room.Text) {
		player.Finished = true
		player.FinishTime = time.Now()
	}

	return wpm, nil
}

type GameOverResult struct {
	PlayerID string  `json:"player_id"`
	Name     string  `json:"name"`
	WPM      float64 `json:"wpm"`
	Accuracy float64 `json:"accuracy"`
	Position int     `json:"position"`
	Finished bool    `json:"finished"`
}

func (rm *RoomManager) CheckGameCompletion(roomID string) (bool, []GameOverResult, string) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return false, nil, ""
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if room.Status != "playing" {
		return false, nil, ""
	}

	allFinished := true
	for _, p := range room.Players {
		if !p.Finished {
			allFinished = false
			break
		}
	}

	timedOut := CheckTimeout(room.GameStart)

	if !allFinished && !timedOut {
		return false, nil, ""
	}

	room.Status = "finished"

	results := make([]GameOverResult, 0, len(room.Players))
	playerResults := make([]PlayerResult, 0, len(room.Players))
	for _, p := range room.Players {
		elapsed := time.Since(p.StartTime)
		if p.Finished {
			elapsed = p.FinishTime.Sub(p.StartTime)
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
		playerResults = append(playerResults, PlayerResult{
			ID:         p.ID,
			Finished:   p.Finished,
			FinishTime: p.FinishTime,
			Accuracy:   accuracy,
		})
	}

	winner := CheckWinner(playerResults)

	return true, results, winner
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
