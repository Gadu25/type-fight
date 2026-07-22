package ws

import (
	"encoding/json"
	"log"

	"github.com/type-fight/server/internal/game"
)

type Handler struct {
	hub         *Hub
	roomManager *game.RoomManager
}

func NewHandler(hub *Hub, roomManager *game.RoomManager) *Handler {
	return &Handler{
		hub:         hub,
		roomManager: roomManager,
	}
}

func (h *Handler) HandleMessage(conn Connection, roomID, playerID string, data []byte) {
	var msg ClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("error unmarshaling message: %v", err)
		return
	}

	switch msg.Type {
	case "join":
		h.handleJoin(conn, roomID, playerID, msg)
	case "ready":
		h.handleReady(conn, roomID, playerID)
	case "start_game":
		h.handleStartGame(conn, roomID, playerID)
	case "keystroke":
		h.handleKeystroke(conn, roomID, playerID, msg)
	}
}

func (h *Handler) handleJoin(conn Connection, roomID, playerID string, msg ClientMessage) {
	err := h.roomManager.JoinRoom(roomID, playerID, msg.PlayerName)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	client := &Client{
		Conn:     conn,
		RoomID:   roomID,
		PlayerID: playerID,
	}
	h.hub.Register(client)

	room := h.roomManager.GetRoom(roomID)
	if room == nil {
		return
	}

	players := make([]PlayerInfo, 0)
	for _, p := range room.Players {
		players = append(players, PlayerInfo{
			ID:   p.ID,
			Name: p.Name,
		})
	}

	listMsg := ServerMessage{
		Type:    "player_list",
		Players: players,
	}
	data, _ := json.Marshal(listMsg)
	conn.WriteMessage(1, data)

	broadcastMsg := ServerMessage{
		Type: "player_joined",
		Player: &PlayerInfo{
			ID:   playerID,
			Name: msg.PlayerName,
		},
	}
	broadcastData, _ := json.Marshal(broadcastMsg)
	h.hub.BroadcastToRoomExcept(roomID, playerID, broadcastData)
}

func (h *Handler) handleReady(conn Connection, roomID, playerID string) {
	// Intentional no-op for MVP. Ready state is not tracked yet;
	// the host can start the game once both players have joined.
}

func (h *Handler) handleStartGame(conn Connection, roomID, playerID string) {
	err := h.roomManager.StartGame(roomID, playerID)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	room := h.roomManager.GetRoom(roomID)

	players := make([]PlayerInfo, 0)
	for _, p := range room.Players {
		players = append(players, PlayerInfo{
			ID:   p.ID,
			Name: p.Name,
		})
	}

	response := ServerMessage{
		Type:    "game_start",
		Text:    room.Text,
		Players: players,
	}

	data, _ := json.Marshal(response)
	h.hub.BroadcastToRoom(roomID, data)
}

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
}

func (h *Handler) sendError(conn Connection, message string) {
	response := ServerMessage{
		Type: "error",
		Error: &ErrorMessage{
			Message: message,
		},
	}

	data, _ := json.Marshal(response)
	conn.WriteMessage(1, data)
}
