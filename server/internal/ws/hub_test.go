package ws

import (
	"sync"
	"testing"
	"time"
)

type MockConn struct {
	mu       sync.Mutex
	messages [][]byte
}

func (m *MockConn) WriteMessage(messageType int, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, data)
	return nil
}

func (m *MockConn) messageCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.messages)
}

func TestHubRegister(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	conn := &MockConn{}
	client := &Client{Conn: conn, RoomID: "room1", PlayerID: "player1"}

	hub.Register(client)

	hub.mu.RLock()
	clients := hub.clients["room1"]
	hub.mu.RUnlock()

	if len(clients) != 1 {
		t.Errorf("expected 1 client, got %d", len(clients))
	}
}

func TestHubBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	conn1 := &MockConn{}
	conn2 := &MockConn{}
	client1 := &Client{Conn: conn1, RoomID: "room1", PlayerID: "player1"}
	client2 := &Client{Conn: conn2, RoomID: "room1", PlayerID: "player2"}

	hub.Register(client1)
	hub.Register(client2)

	hub.BroadcastToRoom("room1", []byte("test message"))

	// Allow time for broadcast
	time.Sleep(10 * time.Millisecond)

	if conn1.messageCount() != 1 {
		t.Errorf("expected 1 message for client1, got %d", conn1.messageCount())
	}
	if conn2.messageCount() != 1 {
		t.Errorf("expected 1 message for client2, got %d", conn2.messageCount())
	}
}

func TestHubSendToPlayer(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	conn1 := &MockConn{}
	conn2 := &MockConn{}
	client1 := &Client{Conn: conn1, RoomID: "room1", PlayerID: "player1"}
	client2 := &Client{Conn: conn2, RoomID: "room1", PlayerID: "player2"}

	hub.Register(client1)
	hub.Register(client2)

	hub.SendToPlayer("room1", "player1", []byte("targeted message"))

	time.Sleep(10 * time.Millisecond)

	if conn1.messageCount() != 1 {
		t.Errorf("expected 1 message for target client, got %d", conn1.messageCount())
	}
	if conn2.messageCount() != 0 {
		t.Errorf("expected 0 messages for non-target client, got %d", conn2.messageCount())
	}
}
