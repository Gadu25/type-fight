package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/type-fight/server/internal/game"
	"github.com/type-fight/server/internal/ws"
)

type Routes struct {
	roomManager *game.RoomManager
	hub         *ws.Hub
	handler     *ws.Handler
	upgrader    websocket.Upgrader
}

func NewRoutes(roomManager *game.RoomManager, hub *ws.Hub, handler *ws.Handler) *Routes {
	return &Routes{
		roomManager: roomManager,
		hub:         hub,
		handler:     handler,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (r *Routes) Setup(mux *http.ServeMux) {
	mux.HandleFunc("/api/rooms", r.handleRooms)
	mux.HandleFunc("/api/rooms/", r.handleRoomByID)
	mux.HandleFunc("/ws/room/", r.handleWebSocket)
}

func (r *Routes) handleRooms(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	playerID := generatePlayerID()

	room := r.roomManager.CreateRoom(playerID, "Host")

	response := map[string]string{
		"room_id":   room.ID,
		"player_id": playerID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (r *Routes) handleRoomByID(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	roomID := strings.TrimPrefix(req.URL.Path, "/api/rooms/")
	room := r.roomManager.GetRoom(roomID)

	if room == nil {
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}

	infos := room.GetPlayerInfos()
	players := make([]ws.PlayerInfo, len(infos))
	for i, p := range infos {
		players[i] = ws.PlayerInfo{ID: p.ID, Name: p.Name}
	}

	response := map[string]interface{}{
		"id":      room.ID,
		"status":  room.Status,
		"players": players,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (r *Routes) handleWebSocket(w http.ResponseWriter, req *http.Request) {
	roomID := strings.TrimPrefix(req.URL.Path, "/ws/room/")

	conn, err := r.upgrader.Upgrade(w, req, nil)
	if err != nil {
		http.Error(w, "Could not upgrade connection", http.StatusBadRequest)
		return
	}

	playerID := generatePlayerID()

	go r.handleWebSocketConnection(conn, roomID, playerID)
}

func (r *Routes) handleWebSocketConnection(conn *websocket.Conn, roomID, playerID string) {
	defer conn.Close()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		r.handler.HandleMessage(conn, roomID, playerID, message)
	}
}

func generatePlayerID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
