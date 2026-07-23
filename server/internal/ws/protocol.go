package ws

// Client -> Server messages
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
	Error        *ErrorMessage    `json:"error,omitempty"`
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
