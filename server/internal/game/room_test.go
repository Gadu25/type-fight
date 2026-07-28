package game

import (
	"testing"
)

func setupTestRoom() (*RoomManager, string, string) {
	rm := NewRoomManager()
	room := rm.CreateRoom("player1-id", "Player1")
	rm.JoinRoom(room.ID, "player1-id", "Player1")
	rm.JoinRoom(room.ID, "player2-id", "Player2")
	rm.StartGame(room.ID, "player1-id")
	return rm, room.ID, "player2-id"
}

func TestPlayerState_HasHP(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	for _, p := range room.Players {
		if p.HP != BasePlayerHP {
			t.Errorf("Expected HP %d, got %d", BasePlayerHP, p.HP)
		}
	}
}

func TestSelectAttack_SetsAttackState(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	var playerID string
	for id := range room.Players {
		playerID = id
		break
	}
	rm.SelectAttack(playerID, "quick")
	room = rm.GetRoom(roomID)
	player := room.Players[playerID]
	if player.CurrentAttack != "quick" {
		t.Errorf("Expected attack 'quick', got '%s'", player.CurrentAttack)
	}
	if player.CurrentPhrase == "" {
		t.Error("Expected phrase to be set")
	}
}

func TestCompleteAttack_AppliesDamage(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "quick")
	rm.CompleteAttack(player1ID, 100, 100)
	room = rm.GetRoom(roomID)
	if room.Players[player2ID].HP != BasePlayerHP-80 {
		t.Errorf("Expected HP %d, got %d", BasePlayerHP-80, room.Players[player2ID].HP)
	}
}

func TestCompleteAttack_InaccuracyReducesDamage(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "quick")
	rm.CompleteAttack(player1ID, 50, 100)
	room = rm.GetRoom(roomID)
	expectedDamage := 80 * 50 / 100
	if room.Players[player2ID].HP != BasePlayerHP-expectedDamage {
		t.Errorf("Expected HP %d, got %d", BasePlayerHP-expectedDamage, room.Players[player2ID].HP)
	}
}

func TestSwitchAttack_DiscardsProgress(t *testing.T) {
	rm, roomID, _ := setupTestRoom()
	room := rm.GetRoom(roomID)
	var playerID string
	for id := range room.Players {
		playerID = id
		break
	}
	rm.SelectAttack(playerID, "quick")
	room = rm.GetRoom(roomID)
	oldPhrase := room.Players[playerID].CurrentPhrase
	rm.SwitchAttack(playerID, "heavy")
	room = rm.GetRoom(roomID)
	player := room.Players[playerID]
	if player.CurrentAttack != "heavy" {
		t.Errorf("Expected attack 'heavy', got '%s'", player.CurrentAttack)
	}
	if player.CurrentPhrase == oldPhrase {
		t.Error("Expected new phrase after switch")
	}
}

func TestCheckBattleEnd_Defeat(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "ultimate")
	rm.CompleteAttack(player1ID, 100, 100)
	rm.SelectAttack(player1ID, "ultimate")
	rm.CompleteAttack(player1ID, 100, 100)
	room = rm.GetRoom(roomID)
	if room.Players[player2ID].HP > 0 {
		t.Error("Expected player2 to be defeated")
	}
	winner, defeated := rm.CheckBattleEnd()
	if winner != player1ID {
		t.Errorf("Expected winner %s, got %s", player1ID, winner)
	}
	if defeated != player2ID {
		t.Errorf("Expected defeated %s, got %s", player2ID, defeated)
	}
}

func TestCheckBattleEnd_NoEnd(t *testing.T) {
	rm, roomID, player2ID := setupTestRoom()
	room := rm.GetRoom(roomID)
	var player1ID string
	for id := range room.Players {
		if id != player2ID {
			player1ID = id
			break
		}
	}
	rm.SelectAttack(player1ID, "quick")
	rm.CompleteAttack(player1ID, 100, 100)
	winner, defeated := rm.CheckBattleEnd()
	if winner != "" || defeated != "" {
		t.Error("Expected no winner yet")
	}
}
