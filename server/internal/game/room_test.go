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
	rm.SelectAttack(playerID, "grunt")
	room = rm.GetRoom(roomID)
	player := room.Players[playerID]
	if player.CurrentAttack != "grunt" {
		t.Errorf("Expected attack 'grunt', got '%s'", player.CurrentAttack)
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
	rm.SelectAttack(player1ID, "grunt")
	rm.CompleteAttack(player1ID, "grunt", "The sword shines bright", 100, 100)
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
	rm.SelectAttack(player1ID, "grunt")
	rm.CompleteAttack(player1ID, "grunt", "Fire burns through darkness", 20, 50)
	room = rm.GetRoom(roomID)
	// 20/50 accuracy → damage = int(80 * 0.4) = 32
	if room.Players[player2ID].HP != BasePlayerHP-32 {
		t.Errorf("Expected HP %d, got %d", BasePlayerHP-32, room.Players[player2ID].HP)
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
	rm.SelectAttack(playerID, "grunt")
	rm.SwitchAttack(playerID, "archer")
	room = rm.GetRoom(roomID)
	player := room.Players[playerID]
	if player.CurrentAttack != "archer" {
		t.Errorf("Expected attack 'archer', got '%s'", player.CurrentAttack)
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
	rm.SelectAttack(player1ID, "wizard")
	rm.CompleteAttack(player1ID, "wizard", "The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon", 100, 100)
	rm.SelectAttack(player1ID, "wizard")
	rm.CompleteAttack(player1ID, "wizard", "The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon", 100, 100)
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
	rm.SelectAttack(player1ID, "grunt")
	rm.CompleteAttack(player1ID, "grunt", "The sword shines bright", 100, 100)
	winner, defeated := rm.CheckBattleEnd()
	if winner != "" || defeated != "" {
		t.Error("Expected no winner yet")
	}
}

func TestIsValidTeam(t *testing.T) {
	valid := []string{"grunt", "archer", "paladin", "cleric"}
	if !IsValidTeam(valid) {
		t.Errorf("expected %v to be a valid team", valid)
	}

	invalid := [][]string{
		{"grunt", "archer", "paladin"},
		{"grunt", "grunt", "grunt", "grunt"},
		{"grunt", "archer", "paladin", "nope"},
		{"grunt", "archer", "paladin", "cleric", "wizard"},
		{},
	}
	for _, team := range invalid {
		if IsValidTeam(team) {
			t.Errorf("expected %v to be invalid", team)
		}
	}
}

func TestContainsTier(t *testing.T) {
	team := []string{"grunt", "archer", "paladin", "cleric"}
	if !containsTier(team, "grunt") {
		t.Error("expected containsTier to find grunt")
	}
	if containsTier(team, "wizard") {
		t.Error("expected containsTier to reject wizard")
	}
}
