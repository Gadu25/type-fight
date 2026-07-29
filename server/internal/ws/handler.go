package ws

import (
	"encoding/json"
	"log"
	"time"

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
	case "select_attack":
		h.handleSelectAttack(conn, roomID, playerID, data)
	case "attack_complete":
		h.handleAttackComplete(conn, roomID, playerID, data)
	case "switch_attack":
		h.handleSwitchAttack(conn, roomID, playerID, data)
	case "play_again":
		h.handlePlayAgain(conn, roomID, playerID)
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
		Type:           "player_list",
		Players:        players,
		YourPlayerID:   playerID,
		HostID:         room.HostID,
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
	allReady, err := h.roomManager.SetPlayerReady(roomID, playerID)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	readyMsg := ServerMessage{
		Type:          "player_ready",
		ReadyPlayerID: playerID,
	}
	readyData, _ := json.Marshal(readyMsg)
	h.hub.BroadcastToRoom(roomID, readyData)

	if allReady {
		room := h.roomManager.GetRoom(roomID)
		if room == nil {
			return
		}

		if room.Status == "lobby" || room.Status == "waiting" {
			err := h.roomManager.StartGame(roomID, playerID)
			if err != nil {
				h.sendError(conn, err.Error())
				return
			}

			room = h.roomManager.GetRoom(roomID)

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
			HostID:  room.HostID,
		}

		startData, _ := json.Marshal(response)
		h.hub.BroadcastToRoom(roomID, startData)

		setupMsg := ServerMessage{
			Type:        "game_setup",
			PhrasePools: game.GetPhrasePools(),
		}
		setupData, _ := json.Marshal(setupMsg)
		h.hub.BroadcastToRoom(roomID, setupData)

		go h.waitForTimeout(roomID)
		go h.waitForBattleTimeout(roomID)
	}
}
}

func (h *Handler) handlePlayAgain(conn Connection, roomID, playerID string) {
	allWant, err := h.roomManager.SetPlayerWantsPlayAgain(roomID, playerID)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	room := h.roomManager.GetRoom(roomID)
	if room == nil {
		return
	}

	var opponentName string
	for _, p := range room.Players {
		if p.ID != playerID {
			opponentName = p.Name
			break
		}
	}

	playAgainMsg := ServerMessage{
		Type:          "play_again_request",
		OpponentName:  opponentName,
	}
	playAgainData, _ := json.Marshal(playAgainMsg)
	h.hub.BroadcastToRoomExcept(roomID, playerID, playAgainData)

	if allWant {
		err := h.roomManager.ResetRoom(roomID)
		if err != nil {
			h.sendError(conn, err.Error())
			return
		}

		lobbyMsg := ServerMessage{
			Type:          "return_to_lobby",
			ReturnToLobby: true,
		}
		lobbyData, _ := json.Marshal(lobbyMsg)
		h.hub.BroadcastToRoom(roomID, lobbyData)

		room = h.roomManager.GetRoom(roomID)
		if room != nil {
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
				HostID:  room.HostID,
			}
			listData, _ := json.Marshal(listMsg)
			h.hub.BroadcastToRoom(roomID, listData)
		}
	}
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
		HostID:  room.HostID,
	}

	data, _ := json.Marshal(response)
	h.hub.BroadcastToRoom(roomID, data)

	setupMsg := ServerMessage{
		Type:        "game_setup",
		PhrasePools: game.GetPhrasePools(),
	}
	setupData, _ := json.Marshal(setupMsg)
	h.hub.BroadcastToRoom(roomID, setupData)

	go h.waitForTimeout(roomID)
	go h.waitForBattleTimeout(roomID)
}

func (h *Handler) waitForTimeout(roomID string) {
	time.Sleep(game.GameTimeLimit + 1*time.Second)

	completed, results, winner := h.roomManager.CheckGameCompletion(roomID)
	if !completed {
		return
	}

	resultInfos := make([]ResultInfo, len(results))
	for i, r := range results {
		resultInfos[i] = ResultInfo{
			PlayerID: r.PlayerID,
			Name:     r.Name,
			WPM:      r.WPM,
			Accuracy: r.Accuracy,
			Position: r.Position,
		}
	}

	gameOverMsg := ServerMessage{
		Type:    "game_over",
		Results: resultInfos,
		Winner:  winner,
	}

	gameOverData, _ := json.Marshal(gameOverMsg)
	h.hub.BroadcastToRoom(roomID, gameOverData)
}

func (h *Handler) waitForBattleTimeout(roomID string) {
	time.Sleep(game.BattleTimeLimit + 1*time.Second)

	winner, defeated := h.roomManager.HandleBattleTimeout(roomID)
	if winner == "" || defeated == "" {
		return
	}

	defeatedMsg := CombatServerMessage{
		Type: "player_defeated",
		PlayerDefeated: &PlayerDefeatedPayload{
			PlayerID: defeated,
		},
	}
	defData, _ := json.Marshal(defeatedMsg)
	h.hub.BroadcastToRoom(roomID, defData)

	battleOver := CombatServerMessage{
		Type: "battle_over",
		BattleOver: &BattleOverPayload{
			Winner: winner,
			Reason: "timeout",
		},
	}
	boData, _ := json.Marshal(battleOver)
	h.hub.BroadcastToRoom(roomID, boData)
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

	// Check if player just finished
	room := h.roomManager.GetRoom(roomID)
	if room != nil {
		playerName := room.GetPlayerName(playerID)
		playerFinished := room.IsPlayerFinished(playerID)

		if playerFinished && playerName != "" {
			finishedMsg := ServerMessage{
				Type: "player_finished",
				PlayerFinished: &PlayerInfo{
					ID:   playerID,
					Name: playerName,
				},
			}
			finishedData, _ := json.Marshal(finishedMsg)
			h.hub.BroadcastToRoom(roomID, finishedData)
		}
	}

	completed, results, winner := h.roomManager.CheckGameCompletion(roomID)
	if completed {
		resultInfos := make([]ResultInfo, len(results))
		for i, r := range results {
			resultInfos[i] = ResultInfo{
				PlayerID: r.PlayerID,
				Name:     r.Name,
				WPM:      r.WPM,
				Accuracy: r.Accuracy,
				Position: r.Position,
			}
		}

		gameOverMsg := ServerMessage{
			Type:    "game_over",
			Results: resultInfos,
			Winner:  winner,
		}

		gameOverData, _ := json.Marshal(gameOverMsg)
		h.hub.BroadcastToRoom(roomID, gameOverData)
	}
}

func (h *Handler) handleSelectAttack(conn Connection, roomID, playerID string, data []byte) {
	var msg CombatClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		h.sendError(conn, "Invalid message format")
		return
	}
	if msg.SelectAttack == nil {
		h.sendError(conn, "Missing attack tier")
		return
	}
	err := h.roomManager.SelectAttack(playerID, msg.SelectAttack.Tier)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}
	room := h.roomManager.GetRoom(roomID)
	if room == nil {
		h.sendError(conn, "Room not found")
		return
	}
	player := room.Players[playerID]
	def := game.GetAttackDef(msg.SelectAttack.Tier)
	response := CombatServerMessage{
		Type: "attack_phrase",
		AttackPhrase: &AttackPhrasePayload{
			Phrase: player.CurrentPhrase,
			Tier:   msg.SelectAttack.Tier,
			Damage: def.Damage,
		},
	}
	respData, _ := json.Marshal(response)
	conn.WriteMessage(1, respData)
}

func (h *Handler) handleAttackComplete(conn Connection, roomID, playerID string, data []byte) {
	var msg CombatClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		h.sendError(conn, "Invalid message format")
		return
	}
	if msg.AttackComplete == nil {
		h.sendError(conn, "Missing attack data")
		return
	}

	attackResult, err := h.roomManager.CompleteAttack(playerID, msg.AttackComplete.Correct, msg.AttackComplete.Total)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	hpUpdate := CombatServerMessage{
		Type: "hp_update",
		HpUpdate: &HpUpdatePayload{
			PlayerID: attackResult.OpponentID,
			HP:       attackResult.NewHP,
			Attacker: playerID,
			Damage:   attackResult.Damage,
		},
	}
	hpData, _ := json.Marshal(hpUpdate)
	h.hub.BroadcastToRoom(roomID, hpData)

	winner, defeated := h.roomManager.CheckBattleEnd()
	if winner != "" && defeated != "" {
		defeatedMsg := CombatServerMessage{
			Type: "player_defeated",
			PlayerDefeated: &PlayerDefeatedPayload{
				PlayerID: defeated,
			},
		}
		defData, _ := json.Marshal(defeatedMsg)
		h.hub.BroadcastToRoom(roomID, defData)

		battleOver := CombatServerMessage{
			Type: "battle_over",
			BattleOver: &BattleOverPayload{
				Winner: winner,
				Reason: "opponent_defeated",
			},
		}
		boData, _ := json.Marshal(battleOver)
		h.hub.BroadcastToRoom(roomID, boData)

		h.roomManager.SetRoomStatus(roomID, "finished")
	}
}

func (h *Handler) handleSwitchAttack(conn Connection, roomID, playerID string, data []byte) {
	var msg CombatClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		h.sendError(conn, "Invalid message format")
		return
	}
	if msg.SwitchAttack == nil {
		h.sendError(conn, "Missing attack tier")
		return
	}
	err := h.roomManager.SwitchAttack(playerID, msg.SwitchAttack.Tier)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}
	room := h.roomManager.GetRoom(roomID)
	if room == nil {
		h.sendError(conn, "Room not found")
		return
	}
	player := room.Players[playerID]
	def := game.GetAttackDef(msg.SwitchAttack.Tier)
	response := CombatServerMessage{
		Type: "attack_phrase",
		AttackPhrase: &AttackPhrasePayload{
			Phrase: player.CurrentPhrase,
			Tier:   msg.SwitchAttack.Tier,
			Damage: def.Damage,
		},
	}
	respData, _ := json.Marshal(response)
	conn.WriteMessage(1, respData)
}

func (h *Handler) HandleDisconnect(roomID, playerID string) {
	result, err := h.roomManager.RemovePlayer(roomID, playerID)
	if err != nil {
		log.Printf("HandleDisconnect: %v", err)
		return
	}

	if result.RoomEmpty {
		return
	}

	room := h.roomManager.GetRoom(roomID)
	if room == nil {
		return
	}

	players := make([]PlayerInfo, 0, len(result.Players))
	for _, p := range result.Players {
		players = append(players, PlayerInfo{ID: p.ID, Name: p.Name})
	}
	leftMsg := CombatServerMessage{
		Type: "player_left",
		PlayerLeft: &PlayerLeftPayload{
			PlayerID:  playerID,
			NewHostID: result.NewHostID,
			Players:   players,
		},
	}
	data, _ := json.Marshal(leftMsg)
	h.hub.BroadcastToRoom(roomID, data)

	if room.Status == "playing" {
		var winnerID string
		for id := range room.Players {
			winnerID = id
			break
		}

		defeatedMsg := CombatServerMessage{
			Type: "player_defeated",
			PlayerDefeated: &PlayerDefeatedPayload{
				PlayerID: playerID,
			},
		}
		defData, _ := json.Marshal(defeatedMsg)
		h.hub.BroadcastToRoom(roomID, defData)

		battleOver := CombatServerMessage{
			Type: "battle_over",
			BattleOver: &BattleOverPayload{
				Winner: winnerID,
				Reason: "forfeit",
			},
		}
		boData, _ := json.Marshal(battleOver)
		h.hub.BroadcastToRoom(roomID, boData)

		h.roomManager.SetRoomStatus(roomID, "finished")
	}
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
