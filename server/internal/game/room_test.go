package game

import (
	"testing"
)

func TestCreateRoom(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	
	if room == nil {
		t.Fatal("expected room to be created")
	}
	
	if room.ID == "" {
		t.Error("expected room to have an ID")
	}
	
	if room.HostID != "host-id" {
		t.Errorf("expected host-id, got %s", room.HostID)
	}
	
	if room.Status != "waiting" {
		t.Errorf("expected status 'waiting', got %s", room.Status)
	}
}

func TestJoinRoom(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	
	err := rm.JoinRoom(room.ID, "player-id", "Player 2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	
	updatedRoom := rm.GetRoom(room.ID)
	if len(updatedRoom.Players) != 2 {
		t.Errorf("expected 2 players, got %d", len(updatedRoom.Players))
	}
}

func TestJoinRoomFull(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	
	rm.JoinRoom(room.ID, "player-id", "Player 2")
	
	err := rm.JoinRoom(room.ID, "player-id-3", "Player 3")
	if err == nil {
		t.Error("expected error when joining full room")
	}
}

func TestStartGame(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	rm.JoinRoom(room.ID, "player-id", "Player 2")
	
	err := rm.StartGame(room.ID, "host-id")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	
	updatedRoom := rm.GetRoom(room.ID)
	if updatedRoom.Status != "playing" {
		t.Errorf("expected status 'playing', got %s", updatedRoom.Status)
	}
	
	if updatedRoom.Text == "" {
		t.Error("expected text to be set")
	}
}

func TestStartGameNotHost(t *testing.T) {
	rm := NewRoomManager()
	room := rm.CreateRoom("host-id", "Host Player")
	rm.JoinRoom(room.ID, "player-id", "Player 2")
	
	err := rm.StartGame(room.ID, "player-id")
	if err == nil {
		t.Error("expected error when non-host tries to start")
	}
}
