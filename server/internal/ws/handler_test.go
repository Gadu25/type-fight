package ws

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/type-fight/server/internal/game"
)

type TestConnection struct {
	messages [][]byte
}

func (t *TestConnection) WriteMessage(messageType int, data []byte) error {
	t.messages = append(t.messages, data)
	return nil
}

func TestHandleJoin(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")
	handler := NewHandler(hub, rm)

	msg := ClientMessage{
		Type:       "join",
		PlayerName: "Test Player",
	}

	data, _ := json.Marshal(msg)
	handler.HandleMessage(conn, room.ID, "player1", data)

	time.Sleep(10 * time.Millisecond)

	if len(conn.messages) == 0 {
		t.Error("expected at least one message to be broadcast")
	}

	var resp ServerMessage
	if err := json.Unmarshal(conn.messages[0], &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Type != "player_joined" {
		t.Errorf("expected type 'player_joined', got '%s'", resp.Type)
	}
	if resp.Player == nil {
		t.Fatal("expected player info")
	}
	if resp.Player.ID != "player1" {
		t.Errorf("expected player ID 'player1', got '%s'", resp.Player.ID)
	}
	if resp.Player.Name != "Test Player" {
		t.Errorf("expected player name 'Test Player', got '%s'", resp.Player.Name)
	}
}

func TestHandleKeystroke(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")

	// Join second player so we can start the game
	err := rm.JoinRoom(room.ID, "player1", "Test Player")
	if err != nil {
		t.Fatalf("failed to join room: %v", err)
	}

	// Start the game so players have start times
	err = rm.StartGame(room.ID, "host1")
	if err != nil {
		t.Fatalf("failed to start game: %v", err)
	}

	// Register the player's connection in the hub so broadcasts reach it
	hub.Register(&Client{
		Conn:     conn,
		RoomID:   room.ID,
		PlayerID: "player1",
	})
	time.Sleep(10 * time.Millisecond)

	handler := NewHandler(hub, rm)

	msg := ClientMessage{
		Type:     "keystroke",
		Char:     "a",
		Position: 5,
	}

	data, _ := json.Marshal(msg)
	handler.HandleMessage(conn, room.ID, "player1", data)

	time.Sleep(10 * time.Millisecond)

	if len(conn.messages) == 0 {
		t.Error("expected progress message")
	}

	var resp ServerMessage
	if err := json.Unmarshal(conn.messages[0], &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Type != "progress" {
		t.Errorf("expected type 'progress', got '%s'", resp.Type)
	}
	if resp.PlayerID != "player1" {
		t.Errorf("expected player ID 'player1', got '%s'", resp.PlayerID)
	}
	if resp.Position != 5 {
		t.Errorf("expected position 5, got %d", resp.Position)
	}
}
