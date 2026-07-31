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
	if len(resp.Players) != 2 {
		t.Errorf("expected 2 players in list (host + joiner), got %d", len(resp.Players))
	}
	foundJoiner := false
	for _, p := range resp.Players {
		if p.ID == "player1" && p.Name == "Test Player" {
			foundJoiner = true
		}
	}
	if !foundJoiner {
		t.Error("expected to find joiner 'player1' in player list")
	}
}

func TestHandleJoinSeesExistingPlayers(t *testing.T) {
	conn1 := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")
	handler := NewHandler(hub, rm)

	// Player 1 joins (host is already in room from CreateRoom)
	msg1 := ClientMessage{Type: "join", PlayerName: "Player 1"}
	data1, _ := json.Marshal(msg1)
	handler.HandleMessage(conn1, room.ID, "player1", data1)
	time.Sleep(10 * time.Millisecond)

	// Player 1 should see host + themselves
	var resp1 ServerMessage
	if err := json.Unmarshal(conn1.messages[0], &resp1); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp1.Type != "player_list" {
		t.Errorf("expected type 'player_list', got '%s'", resp1.Type)
	}
	if len(resp1.Players) != 2 {
		t.Errorf("expected 2 players in list (host + player1), got %d", len(resp1.Players))
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

func TestHandleSelectAttack_StoresAttack(t *testing.T) {
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

	msg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "grunt",
		},
	}
	data, _ := json.Marshal(msg)
	handler.handleSelectAttack(conn, room.ID, "player1", data)

	time.Sleep(10 * time.Millisecond)

	room = rm.GetRoom(room.ID)
	if room == nil {
		t.Fatal("room not found")
	}
	player := room.Players["player1"]
	if player.CurrentAttack != "grunt" {
		t.Errorf("expected CurrentAttack 'quick', got '%s'", player.CurrentAttack)
	}
}

func TestHandleAttackComplete_AppliesDamage(t *testing.T) {
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

	// Select an attack first
	selectMsg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "grunt",
		},
	}
	selectData, _ := json.Marshal(selectMsg)
	handler.handleSelectAttack(conn, room.ID, "player1", selectData)
	time.Sleep(10 * time.Millisecond)

	// Complete the attack
	completeMsg := CombatClientMessage{
		Type: "attack_complete",
		AttackComplete: &AttackCompletePayload{
			Tier:    "grunt",
			Phrase:  "The sword shines bright",
			Correct: 22,
			Total:   22,
		},
	}
	completeData, _ := json.Marshal(completeMsg)
	handler.handleAttackComplete(conn, room.ID, "player1", completeData)
	time.Sleep(10 * time.Millisecond)

	// Should have hp_update message
	foundHPUpdate := false
	for _, msgBytes := range conn.messages {
		var resp CombatServerMessage
		if err := json.Unmarshal(msgBytes, &resp); err != nil {
			continue
		}
		if resp.Type == "hp_update" {
			foundHPUpdate = true
			if resp.HpUpdate == nil {
				t.Fatal("expected hp_update payload")
			}
			if resp.HpUpdate.PlayerID != "host1" {
				t.Errorf("expected hp update for 'host1', got '%s'", resp.HpUpdate.PlayerID)
			}
			if resp.HpUpdate.Attacker != "player1" {
				t.Errorf("expected attacker 'player1', got '%s'", resp.HpUpdate.Attacker)
			}
			if resp.HpUpdate.Damage <= 0 {
				t.Errorf("expected positive damage, got %d", resp.HpUpdate.Damage)
			}
		}
	}
	if !foundHPUpdate {
		t.Error("expected hp_update message to be sent")
	}
}

func TestHandleSwitchAttack_UpdatesTier(t *testing.T) {
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

	// Select an attack first
	selectMsg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "grunt",
		},
	}
	selectData, _ := json.Marshal(selectMsg)
	handler.handleSelectAttack(conn, room.ID, "player1", selectData)
	time.Sleep(10 * time.Millisecond)

	// Switch to a different attack
	switchMsg := CombatClientMessage{
		Type: "switch_attack",
		SwitchAttack: &SwitchAttackPayload{
			Tier: "paladin",
		},
	}
	switchData, _ := json.Marshal(switchMsg)
	handler.handleSwitchAttack(conn, room.ID, "player1", switchData)
	time.Sleep(10 * time.Millisecond)

	// Verify the CurrentAttack was updated
	room = rm.GetRoom(room.ID)
	if room == nil {
		t.Fatal("room not found")
	}
	player := room.Players["player1"]
	if player.CurrentAttack != "paladin" {
		t.Errorf("expected CurrentAttack 'heavy', got '%s'", player.CurrentAttack)
	}
}

func TestHandleSelectAttack_BroadcastsOpponentAttack(t *testing.T) {
	hostConn := &TestConnection{}
	playerConn := &TestConnection{}
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

	hub.Register(&Client{Conn: hostConn, RoomID: room.ID, PlayerID: "host1"})
	hub.Register(&Client{Conn: playerConn, RoomID: room.ID, PlayerID: "player1"})
	time.Sleep(10 * time.Millisecond)

	handler := NewHandler(hub, rm)

	selectMsg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "grunt",
		},
	}
	selectData, _ := json.Marshal(selectMsg)
	handler.handleSelectAttack(playerConn, room.ID, "player1", selectData)
	time.Sleep(10 * time.Millisecond)

	foundOpponentAttack := false
	for _, msgBytes := range hostConn.messages {
		var resp CombatServerMessage
		if err := json.Unmarshal(msgBytes, &resp); err != nil {
			continue
		}
		if resp.Type == "opponent_attack" {
			foundOpponentAttack = true
			if resp.OpponentAttack == nil {
				t.Fatal("expected opponent_attack payload")
			}
			if resp.OpponentAttack.PlayerID != "player1" {
				t.Errorf("expected PlayerID 'player1', got '%s'", resp.OpponentAttack.PlayerID)
			}
			if resp.OpponentAttack.Tier != "grunt" {
				t.Errorf("expected Tier 'quick', got '%s'", resp.OpponentAttack.Tier)
			}
		}
	}
	if !foundOpponentAttack {
		t.Error("expected opponent_attack broadcast to other players")
	}
}

func TestHandleSwitchAttack_BroadcastsOpponentAttack(t *testing.T) {
	hostConn := &TestConnection{}
	playerConn := &TestConnection{}
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

	hub.Register(&Client{Conn: hostConn, RoomID: room.ID, PlayerID: "host1"})
	hub.Register(&Client{Conn: playerConn, RoomID: room.ID, PlayerID: "player1"})
	time.Sleep(10 * time.Millisecond)

	handler := NewHandler(hub, rm)

	// Select an attack first
	selectMsg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "grunt",
		},
	}
	selectData, _ := json.Marshal(selectMsg)
	handler.handleSelectAttack(playerConn, room.ID, "player1", selectData)
	time.Sleep(10 * time.Millisecond)

	// Switch to a different attack
	switchMsg := CombatClientMessage{
		Type: "switch_attack",
		SwitchAttack: &SwitchAttackPayload{
			Tier: "paladin",
		},
	}
	switchData, _ := json.Marshal(switchMsg)
	handler.handleSwitchAttack(playerConn, room.ID, "player1", switchData)
	time.Sleep(10 * time.Millisecond)

	foundOpponentAttack := false
	for _, msgBytes := range hostConn.messages {
		var resp CombatServerMessage
		if err := json.Unmarshal(msgBytes, &resp); err != nil {
			continue
		}
		if resp.Type == "opponent_attack" && resp.OpponentAttack != nil && resp.OpponentAttack.Tier == "paladin" {
			foundOpponentAttack = true
			if resp.OpponentAttack.PlayerID != "player1" {
				t.Errorf("expected PlayerID 'player1', got '%s'", resp.OpponentAttack.PlayerID)
			}
		}
	}
	if !foundOpponentAttack {
		t.Error("expected opponent_attack broadcast with updated tier after switch")
	}
}

func TestHandleAttackComplete_LethalSendsBattleOver(t *testing.T) {
	hostConn := &TestConnection{}
	p2Conn := &TestConnection{}
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

	// Set host HP to 400 so one ultimate attack kills
	// Note: direct field access in tests is fine; data race acceptable in test code
	room = rm.GetRoom(room.ID)
	room.Players["host1"].HP = 400

	hub.Register(&Client{Conn: hostConn, RoomID: room.ID, PlayerID: "host1"})
	hub.Register(&Client{Conn: p2Conn, RoomID: room.ID, PlayerID: "player1"})
	time.Sleep(10 * time.Millisecond)

	handler := NewHandler(hub, rm)

	// Select ultimate attack on player1
	selectMsg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{Tier: "wizard"},
	}
	selectData, _ := json.Marshal(selectMsg)
	handler.handleSelectAttack(p2Conn, room.ID, "player1", selectData)
	time.Sleep(10 * time.Millisecond)

	// Complete attack with ultimate phrase
	completeMsg := CombatClientMessage{
		Type: "attack_complete",
		AttackComplete: &AttackCompletePayload{
			Tier:    "wizard",
			Phrase:  "The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon",
			Correct: 98,
			Total:   98,
		},
	}
	completeData, _ := json.Marshal(completeMsg)
	handler.handleAttackComplete(p2Conn, room.ID, "player1", completeData)
	time.Sleep(10 * time.Millisecond)

	// Check p2's messages for battle_over
	foundBattleOver := false
	for _, msgBytes := range p2Conn.messages {
		var resp CombatServerMessage
		if err := json.Unmarshal(msgBytes, &resp); err != nil {
			continue
		}
		if resp.Type == "battle_over" {
			foundBattleOver = true
			if resp.BattleOver == nil {
				t.Fatal("expected battle_over payload")
			}
			if resp.BattleOver.Winner != "player1" {
				t.Errorf("expected winner 'player1', got '%s'", resp.BattleOver.Winner)
			}
			if resp.BattleOver.Reason != "opponent_defeated" {
				t.Errorf("expected reason 'opponent_defeated', got '%s'", resp.BattleOver.Reason)
			}
		}
	}
	if !foundBattleOver {
		t.Error("expected battle_over message to be sent to attacker")
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

func TestHandleStartGame_SendsGameSetupWithBattleground(t *testing.T) {
	connHost := &TestConnection{}
	connJoiner := &TestConnection{}
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	rm := game.NewRoomManager()
	room := rm.CreateRoom("host1", "Host Player")
	handler := NewHandler(hub, rm)

	// Both players must join so their connections are registered with the hub;
	// broadcasts (game_start, game_setup) only reach registered clients.
	hostJoin, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Host Player"})
	handler.HandleMessage(connHost, room.ID, "host1", hostJoin)
	time.Sleep(10 * time.Millisecond)

	joinerJoin, _ := json.Marshal(ClientMessage{Type: "join", PlayerName: "Joiner"})
	handler.HandleMessage(connJoiner, room.ID, "player2", joinerJoin)
	time.Sleep(10 * time.Millisecond)

	startData, _ := json.Marshal(ClientMessage{Type: "start_game"})
	handler.HandleMessage(connHost, room.ID, "host1", startData)
	time.Sleep(20 * time.Millisecond)

	found := false
	for _, raw := range connHost.messages {
		var resp ServerMessage
		if err := json.Unmarshal(raw, &resp); err != nil {
			continue
		}
		if resp.Type == "game_setup" && resp.Battleground != "" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected a game_setup message carrying a battleground id")
	}
}
