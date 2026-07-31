package ws

import (
	"encoding/json"
	"fmt"
)

// Client -> Server messages
// Supported types: "join", "ready", "start_game", "keystroke", "play_again"
type ClientMessage struct {
	Type       string `json:"type"`
	PlayerName string `json:"player_name,omitempty"`
	Char       string `json:"char,omitempty"`
	Position   int    `json:"position,omitempty"`
}

// Server -> Client messages
type ServerMessage struct {
	Type         string           `json:"type"`
	Player       *PlayerInfo      `json:"player,omitempty"`
	Text         string           `json:"text,omitempty"`
	Players      []PlayerInfo     `json:"players,omitempty"`
	PlayerID     string           `json:"player_id,omitempty"`
	YourPlayerID string           `json:"your_player_id,omitempty"`
	Position     int              `json:"position,omitempty"`
	WPM          float64          `json:"wpm,omitempty"`
	Accuracy     float64          `json:"accuracy,omitempty"`
	Winner       string           `json:"winner,omitempty"`
	Results      []ResultInfo     `json:"results,omitempty"`
	Error          *ErrorMessage    `json:"error,omitempty"`
	PlayerFinished *PlayerInfo      `json:"player_finished,omitempty"`
	ReadyPlayerID  string           `json:"ready_player_id,omitempty"`
	OpponentName   string           `json:"opponent_name,omitempty"`
	ReturnToLobby  bool             `json:"return_to_lobby,omitempty"`
	HostID         string           `json:"host_id,omitempty"`
	PhrasePools    map[string][]string `json:"phrase_pools,omitempty"`
	Battleground   string              `json:"battleground,omitempty"`
}

type PlayerInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ResultInfo struct {
	PlayerID string  `json:"player_id"`
	Name     string  `json:"name"`
	WPM      float64 `json:"wpm"`
	Accuracy float64 `json:"accuracy"`
	Position int     `json:"position"`
}

type ErrorMessage struct {
	Message string `json:"message"`
}

// Combat Client -> Server messages
type CombatClientMessage struct {
	Type           string                  `json:"type"`
	SelectAttack   *SelectAttackPayload    `json:"select_attack,omitempty"`
	AttackComplete *AttackCompletePayload  `json:"attack_complete,omitempty"`
	SwitchAttack   *SwitchAttackPayload    `json:"switch_attack,omitempty"`
}

type SelectAttackPayload struct {
	Tier string `json:"tier"`
}

type AttackCompletePayload struct {
	Tier    string `json:"tier"`
	Phrase  string `json:"phrase"`
	Correct int    `json:"correct"`
	Total   int    `json:"total"`
}

type SwitchAttackPayload struct {
	Tier string `json:"tier"`
}

type OpponentAttackPayload struct {
	PlayerID string `json:"playerID"`
	Tier     string `json:"tier"`
}

type PlayerLeftPayload struct {
	PlayerID  string       `json:"playerID"`
	NewHostID string       `json:"new_host_id,omitempty"`
	Players   []PlayerInfo `json:"players"`
}

// Combat Server -> Client messages
type CombatServerMessage struct {
	Type           string                 `json:"type"`
	HpUpdate       *HpUpdatePayload       `json:"hp_update,omitempty"`
	HealUpdate     *HealUpdatePayload     `json:"heal_update,omitempty"`
	PlayerDefeated *PlayerDefeatedPayload `json:"player_defeated,omitempty"`
	BattleOver     *BattleOverPayload     `json:"battle_over,omitempty"`
	GameStart      *GameStartPayload      `json:"game_start,omitempty"`
	PlayerLeft     *PlayerLeftPayload     `json:"player_left,omitempty"`
	OpponentAttack *OpponentAttackPayload `json:"opponent_attack,omitempty"`
}

type HpUpdatePayload struct {
	PlayerID string `json:"playerID"`
	HP       int    `json:"hp"`
	Attacker string `json:"attacker"`
	Damage   int    `json:"damage"`
}

type HealUpdatePayload struct {
	PlayerID string `json:"playerID"`
	HP       int    `json:"hp"`
	Heal     int    `json:"heal"`
}

type PlayerDefeatedPayload struct {
	PlayerID string `json:"playerID"`
}

type BattleOverPayload struct {
	Winner string `json:"winner"`
	Reason string `json:"reason"`
}

type GameStartPayload struct {
	Players []CombatPlayerInfo `json:"players"`
}

type CombatPlayerInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	HP   int    `json:"hp"`
}

func ParseClientMessage(data []byte) (*ClientMessage, error) {
	var msg ClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("invalid message format: %v", err)
	}
	return &msg, nil
}
