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
		t.Error("expected at least one message to be sent")
	}

	var resp ServerMessage
	if err := json.Unmarshal(conn.messages[0], &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Type != "player_list" {
		t.Errorf("expected type 'player_list', got '%s'", resp.Type)
	}
	if len(resp.Players) != 1 {
		t.Errorf("expected 1 player in list, got %d", len(resp.Players))
	}
	if resp.Players[0].ID != "player1" {
		t.Errorf("expected player ID 'player1', got '%s'", resp.Players[0].ID)
	}
	if resp.Players[0].Name != "Test Player" {
		t.Errorf("expected player name 'Test Player', got '%s'", resp.Players[0].Name)
	}
}

func TestHandleJoinSeesExistingPlayers(t *testing.T) {
	conn1 := &TestConnection{}
	conn2 := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")
	handler := NewHandler(hub, rm)

	// Player 1 joins
	msg1 := ClientMessage{Type: "join", PlayerName: "Player 1"}
	data1, _ := json.Marshal(msg1)
	handler.HandleMessage(conn1, room.ID, "player1", data1)
	time.Sleep(10 * time.Millisecond)

	// Player 2 joins
	msg2 := ClientMessage{Type: "join", PlayerName: "Player 2"}
	data2, _ := json.Marshal(msg2)
	handler.HandleMessage(conn2, room.ID, "player2", data2)
	time.Sleep(10 * time.Millisecond)

	// Player 2 should receive player_list with both players
	var resp ServerMessage
	if err := json.Unmarshal(conn2.messages[0], &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Type != "player_list" {
		t.Errorf("expected type 'player_list', got '%s'", resp.Type)
	}
	if len(resp.Players) != 2 {
		t.Errorf("expected 2 players in list, got %d", len(resp.Players))
	}
}

func TestHandleKeystroke(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")

	// Join both players
	err := rm.JoinRoom(room.ID, "host1", "Host")
	if err != nil {
		t.Fatalf("failed to join host: %v", err)
	}
	err = rm.JoinRoom(room.ID, "player1", "Test Player")
	if err != nil {
		t.Fatalf("failed to join player: %v", err)
	}

	// Start the game
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

func TestHandleKeystrokePlayerFinished(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")

	err := rm.JoinRoom(room.ID, "host1", "Host")
	if err != nil {
		t.Fatalf("failed to join host: %v", err)
	}
	err = rm.JoinRoom(room.ID, "player1", "Test Player")
	if err != nil {
		t.Fatalf("failed to join player: %v", err)
	}

	err = rm.StartGame(room.ID, "host1")
	if err != nil {
		t.Fatalf("failed to start game: %v", err)
	}

	// Get the text length to know what position means "finished"
	room = rm.GetRoom(room.ID)
	textLen := len(room.Text)

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
		Position: textLen,
	}

	data, _ := json.Marshal(msg)
	handler.HandleMessage(conn, room.ID, "player1", data)

	time.Sleep(10 * time.Millisecond)

	// Should have at least 2 messages: progress + player_finished
	if len(conn.messages) < 2 {
		t.Fatalf("expected at least 2 messages (progress + player_finished), got %d", len(conn.messages))
	}

	// First message should be progress
	var progressMsg ServerMessage
	if err := json.Unmarshal(conn.messages[0], &progressMsg); err != nil {
		t.Fatalf("failed to unmarshal progress message: %v", err)
	}
	if progressMsg.Type != "progress" {
		t.Errorf("expected first message type 'progress', got '%s'", progressMsg.Type)
	}

	// Second message should be player_finished
	var finishedMsg ServerMessage
	if err := json.Unmarshal(conn.messages[1], &finishedMsg); err != nil {
		t.Fatalf("failed to unmarshal player_finished message: %v", err)
	}
	if finishedMsg.Type != "player_finished" {
		t.Errorf("expected second message type 'player_finished', got '%s'", finishedMsg.Type)
	}
	if finishedMsg.PlayerFinished == nil {
		t.Fatal("expected player_finished to have PlayerInfo")
	}
	if finishedMsg.PlayerFinished.ID != "player1" {
		t.Errorf("expected player ID 'player1', got '%s'", finishedMsg.PlayerFinished.ID)
	}
	if finishedMsg.PlayerFinished.Name != "Test Player" {
		t.Errorf("expected player name 'Test Player', got '%s'", finishedMsg.PlayerFinished.Name)
	}
}

func TestHandleKeystrokePlayerNotFinished(t *testing.T) {
	conn := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")

	err := rm.JoinRoom(room.ID, "host1", "Host")
	if err != nil {
		t.Fatalf("failed to join host: %v", err)
	}
	err = rm.JoinRoom(room.ID, "player1", "Test Player")
	if err != nil {
		t.Fatalf("failed to join player: %v", err)
	}

	err = rm.StartGame(room.ID, "host1")
	if err != nil {
		t.Fatalf("failed to start game: %v", err)
	}

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

	// Should only have 1 message: progress (no player_finished)
	if len(conn.messages) != 1 {
		t.Fatalf("expected 1 message (progress only), got %d", len(conn.messages))
	}

	var progressMsg ServerMessage
	if err := json.Unmarshal(conn.messages[0], &progressMsg); err != nil {
		t.Fatalf("failed to unmarshal progress message: %v", err)
	}
	if progressMsg.Type != "progress" {
		t.Errorf("expected type 'progress', got '%s'", progressMsg.Type)
	}
}
