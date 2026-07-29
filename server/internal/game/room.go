package game

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type PlayerState struct {
	ID                 string
	Name               string
	Position           int
	Correct            int
	Total              int
	StartTime          time.Time
	Finished           bool
	FinishTime         time.Time
	FirstKeystrokeTime time.Time
	Ready              bool
	WantsPlayAgain     bool
	HP                 int
	CurrentAttack      string
	CurrentPhrase      string
	PhraseCorrect      int
	PhraseTotal        int
	AttackStartTime    time.Time
	IsAlive            bool
}

type Room struct {
	ID               string
	Players          map[string]*PlayerState
	HostID           string
	Status           string // "waiting", "playing", "finished"
	Text             string
	GameStart        time.Time
	BattleStartTime  time.Time
	BattleTimeLimit  time.Duration
	Winner           string
	mu               sync.RWMutex
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
		ID:              generateID(),
		Players:         make(map[string]*PlayerState),
		HostID:          hostID,
		Status:          "waiting",
		BattleTimeLimit: BattleTimeLimit,
	}
	
	room.Players[hostID] = &PlayerState{
		ID:      hostID,
		Name:    hostName,
		HP:      BasePlayerHP,
		IsAlive: true,
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
		ID:      playerID,
		Name:    playerName,
		HP:      BasePlayerHP,
		IsAlive: true,
	}
	
	return nil
}

type RemovePlayerResult struct {
	NewHostID string
	Players   []PlayerInfo
	RoomEmpty bool
}

func (rm *RoomManager) RemovePlayer(roomID, playerID string) (*RemovePlayerResult, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if _, exists := room.Players[playerID]; !exists {
		return nil, fmt.Errorf("player not in room")
	}

	delete(room.Players, playerID)

	if len(room.Players) == 0 {
		return &RemovePlayerResult{RoomEmpty: true}, nil
	}

	var newHostID string
	if room.HostID == playerID {
		for id := range room.Players {
			newHostID = id
			break
		}
		room.HostID = newHostID
	}

	players := make([]PlayerInfo, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, PlayerInfo{
			ID:   p.ID,
			Name: p.Name,
		})
	}

	return &RemovePlayerResult{
		NewHostID: newHostID,
		Players:   players,
		RoomEmpty: false,
	}, nil
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
	room.BattleStartTime = time.Now()
	
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

	if player.FirstKeystrokeTime.IsZero() && position > 0 {
		player.FirstKeystrokeTime = time.Now()
	}

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
		playerResults = append(playerResults, PlayerResult{
			ID:       p.ID,
			Finished: p.Finished,
			WPM:      wpm,
			Accuracy: accuracy,
		})
	}

	winner := CheckWinner(playerResults)

	return true, results, winner
}

func (r *Room) IsPlayerFinished(playerID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	player, exists := r.Players[playerID]
	if !exists {
		return false
	}
	return player.Finished
}

func (r *Room) GetPlayerName(playerID string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	player, exists := r.Players[playerID]
	if !exists {
		return ""
	}
	return player.Name
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

func (rm *RoomManager) SetPlayerReady(roomID, playerID string) (bool, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return false, fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	player, exists := room.Players[playerID]
	if !exists {
		return false, fmt.Errorf("player not in room")
	}

	player.Ready = true

	allReady := true
	for _, p := range room.Players {
		if !p.Ready {
			allReady = false
			break
		}
	}

	return allReady, nil
}

func (rm *RoomManager) SetPlayerWantsPlayAgain(roomID, playerID string) (bool, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return false, fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	player, exists := room.Players[playerID]
	if !exists {
		return false, fmt.Errorf("player not in room")
	}

	player.WantsPlayAgain = true

	allWant := true
	for _, p := range room.Players {
		if !p.WantsPlayAgain {
			allWant = false
			break
		}
	}

	return allWant, nil
}

func (rm *RoomManager) ResetRoom(roomID string) error {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	room.Status = "lobby"
	room.Text = ""
	room.GameStart = time.Time{}
	room.BattleStartTime = time.Time{}
	room.Winner = ""

	for _, p := range room.Players {
		p.Position = 0
		p.Finished = false
		p.FinishTime = time.Time{}
		p.FirstKeystrokeTime = time.Time{}
		p.StartTime = time.Time{}
		p.Ready = false
		p.WantsPlayAgain = false
		p.HP = BasePlayerHP
		p.CurrentAttack = ""
		p.CurrentPhrase = ""
		p.PhraseCorrect = 0
		p.PhraseTotal = 0
		p.AttackStartTime = time.Time{}
		p.IsAlive = true
	}

	return nil
}

func (rm *RoomManager) SetRoomStatus(roomID, status string) error {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("room not found")
	}

	room.mu.Lock()
	defer room.mu.Unlock()
	room.Status = status
	return nil
}

func (rm *RoomManager) SelectAttack(playerID, tier string) error {
	def := GetAttackDef(tier)
	if def.MinWords == 0 {
		return fmt.Errorf("invalid attack tier: %s", tier)
	}
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	for _, room := range rm.rooms {
		room.mu.Lock()
		player, exists := room.Players[playerID]
		if !exists {
			room.mu.Unlock()
			continue
		}
		player.CurrentAttack = tier
		room.mu.Unlock()
		return nil
	}
	return fmt.Errorf("player not found")
}

type AttackResult struct {
	OpponentID string
	OldHP      int
	NewHP      int
	Damage     int
	IsHeal     bool
	PlayerID   string
	HealAmount int
}

func (rm *RoomManager) CompleteAttack(playerID, tier, phrase string, correct, total int) (*AttackResult, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	for _, room := range rm.rooms {
		room.mu.Lock()
		attacker, exists := room.Players[playerID]
		if !exists {
			room.mu.Unlock()
			continue
		}
		if attacker.CurrentAttack == "" {
			room.mu.Unlock()
			return nil, fmt.Errorf("no active attack")
		}
		if attacker.CurrentAttack != tier {
			room.mu.Unlock()
			return nil, fmt.Errorf("attack tier mismatch")
		}

		def := GetAttackDef(tier)
		pool := phrasePools[tier]
		valid := false
		for _, p := range pool {
			if p == phrase {
				valid = true
				break
			}
		}
		if !valid {
			room.mu.Unlock()
			return nil, fmt.Errorf("invalid phrase for tier %s", tier)
		}
		if correct < 1 || correct > len(phrase) {
			correct = len(phrase)
		}
		if total < correct || total > len(phrase)*3 {
			total = correct
		}

		accuracy := CalculateAccuracy(correct, total)
		if accuracy < 0.25 {
			accuracy = 0.25
		}

		var result *AttackResult
		if def.IsHeal {
			healAmount := CalculateDamage(def.Heal, accuracy)
			oldHP := attacker.HP
			attacker.HP += healAmount
			if attacker.HP > BasePlayerHP {
				attacker.HP = BasePlayerHP
			}
			result = &AttackResult{
				IsHeal:     true,
				PlayerID:   playerID,
				OldHP:      oldHP,
				NewHP:      attacker.HP,
				HealAmount: attacker.HP - oldHP,
			}
		} else {
			damage := CalculateDamage(def.Damage, accuracy)
			for id, p := range room.Players {
				if id != playerID && p.IsAlive {
					oldHP := p.HP
					p.HP -= damage
					if p.HP <= 0 {
						p.HP = 0
						p.IsAlive = false
					}
					result = &AttackResult{
						OpponentID: id,
						OldHP:      oldHP,
						NewHP:      p.HP,
						Damage:     oldHP - p.HP,
					}
				}
			}
			if result == nil {
				attacker.CurrentAttack = ""
				room.mu.Unlock()
				return nil, fmt.Errorf("no valid opponent found")
			}
		}

		attacker.CurrentAttack = ""
		room.mu.Unlock()
		return result, nil
	}
	return nil, fmt.Errorf("player not found")
}

func (rm *RoomManager) SwitchAttack(playerID, newTier string) error {
	def := GetAttackDef(newTier)
	if def.MinWords == 0 {
		return fmt.Errorf("invalid attack tier: %s", newTier)
	}
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	for _, room := range rm.rooms {
		room.mu.Lock()
		player, exists := room.Players[playerID]
		if !exists {
			room.mu.Unlock()
			continue
		}
		player.CurrentAttack = newTier
		room.mu.Unlock()
		return nil
	}
	return fmt.Errorf("player not found")
}

func (rm *RoomManager) CheckBattleEnd() (winner string, defeated string) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	for _, room := range rm.rooms {
		room.mu.RLock()
		if room.Status != "playing" {
			room.mu.RUnlock()
			continue
		}
		for id, p := range room.Players {
			if !p.IsAlive {
				for otherID, other := range room.Players {
					if otherID != id && other.IsAlive {
						room.mu.RUnlock()
						return otherID, id
					}
				}
			}
		}
		if time.Since(room.BattleStartTime) > room.BattleTimeLimit {
			var highestHP int
			var winnerID string
			for id, p := range room.Players {
				if p.HP > highestHP {
					highestHP = p.HP
					winnerID = id
				}
			}
			for id := range room.Players {
				if id != winnerID {
					room.mu.RUnlock()
					return winnerID, id
				}
			}
		}
		room.mu.RUnlock()
	}
	return "", ""
}

func (rm *RoomManager) HandleBattleTimeout(roomID string) (winner, defeated string) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return "", ""
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if room.Status != "playing" {
		return "", ""
	}

	var highestHP int
	var winnerID string
	var defeatedID string
	for id, p := range room.Players {
		if p.HP > highestHP {
			highestHP = p.HP
			winnerID = id
		}
	}
	for id := range room.Players {
		if id != winnerID {
			defeatedID = id
			break
		}
	}

	room.Status = "finished"
	return winnerID, defeatedID
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
