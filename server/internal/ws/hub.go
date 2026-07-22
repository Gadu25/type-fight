package ws

import (
	"sync"
)

type Client struct {
	Conn     Connection
	RoomID   string
	PlayerID string
}

type Connection interface {
	WriteMessage(messageType int, data []byte) error
}

type Hub struct {
	clients    map[string][]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
	mu         sync.RWMutex
	stop       chan struct{}
}

type BroadcastMessage struct {
	RoomID  string
	Message []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string][]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMessage),
		stop:       make(chan struct{}),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.RoomID] = append(h.clients[client.RoomID], client)
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			clients := h.clients[client.RoomID]
			for i, c := range clients {
				if c.PlayerID == client.PlayerID {
					h.clients[client.RoomID] = append(clients[:i], clients[i+1:]...)
					break
				}
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := h.clients[msg.RoomID]
			h.mu.RUnlock()

			for _, client := range clients {
				client.Conn.WriteMessage(1, msg.Message)
			}

		case <-h.stop:
			return
		}
	}
}

func (h *Hub) Stop() {
	close(h.stop)
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) BroadcastToRoom(roomID string, message []byte) {
	h.broadcast <- &BroadcastMessage{RoomID: roomID, Message: message}
}

func (h *Hub) BroadcastToRoomExcept(roomID, excludePlayerID string, message []byte) {
	h.mu.RLock()
	snapshot := make([]*Client, len(h.clients[roomID]))
	copy(snapshot, h.clients[roomID])
	h.mu.RUnlock()

	for _, client := range snapshot {
		if client.PlayerID != excludePlayerID {
			client.Conn.WriteMessage(1, message)
		}
	}
}

func (h *Hub) GetClients(roomID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.clients[roomID]
}
