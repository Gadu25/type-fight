package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/type-fight/server/internal/api"
	"github.com/type-fight/server/internal/game"
	"github.com/type-fight/server/internal/ws"
)

type safeWS struct {
	conn     *websocket.Conn
	mu       sync.Mutex
	messages []ws.ServerMessage
	failed   bool
	done     chan struct{}
}

func newSafeWS(conn *websocket.Conn) *safeWS {
	s := &safeWS{
		conn: conn,
		done: make(chan struct{}),
	}
	go s.readLoop()
	return s
}

func (s *safeWS) readLoop() {
	defer close(s.done)
	for {
		select {
		case <-s.done:
			return
		default:
		}
		func() {
			defer func() {
				if r := recover(); r != nil {
					s.mu.Lock()
					s.failed = true
					s.mu.Unlock()
				}
			}()
			_, data, err := s.conn.ReadMessage()
			if err != nil {
				s.mu.Lock()
				s.failed = true
				s.mu.Unlock()
				return
			}
			var msg ws.ServerMessage
			if err := json.Unmarshal(data, &msg); err == nil {
				s.mu.Lock()
				s.messages = append(s.messages, msg)
				s.mu.Unlock()
			}
		}()
		s.mu.Lock()
		f := s.failed
		s.mu.Unlock()
		if f {
			return
		}
	}
}

func (s *safeWS) close() {
	s.conn.Close()
	<-s.done
}

func (s *safeWS) waitFor(t *testing.T, msgType string, timeout time.Duration) ws.ServerMessage {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		for _, msg := range s.messages {
			if msg.Type == msgType {
				s.mu.Unlock()
				return msg
			}
		}
		s.mu.Unlock()
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for message type '%s' after %v", msgType, timeout)
	return ws.ServerMessage{}
}

func (s *safeWS) waitForCondition(t *testing.T, predicate func([]ws.ServerMessage) bool, desc string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		msgs := make([]ws.ServerMessage, len(s.messages))
		copy(msgs, s.messages)
		s.mu.Unlock()
		if predicate(msgs) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for condition '%s' after %v", desc, timeout)
}

func (s *safeWS) hasProgressFrom(playerID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, msg := range s.messages {
		if msg.Type == "progress" && msg.PlayerID == playerID {
			return true
		}
	}
	return false
}

func (s *safeWS) lastProgressFor(playerID string) *ws.ServerMessage {
	s.mu.Lock()
	defer s.mu.Unlock()
	var last *ws.ServerMessage
	for i := range s.messages {
		if s.messages[i].Type == "progress" && s.messages[i].PlayerID == playerID {
			last = &s.messages[i]
		}
	}
	return last
}

func (s *safeWS) countMessages(msgType string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	count := 0
	for _, msg := range s.messages {
		if msg.Type == msgType {
			count++
		}
	}
	return count
}

func setupServer(t *testing.T) (*httptest.Server, string) {
	t.Helper()
	roomManager := game.NewRoomManager()
	hub := ws.NewHub()
	go hub.Run()
	t.Cleanup(func() { hub.Stop() })

	handler := ws.NewHandler(hub, roomManager)
	routes := api.NewRoutes(roomManager, hub, handler)

	mux := http.NewServeMux()
	routes.Setup(mux)

	server := httptest.NewServer(mux)
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	return server, wsURL
}

func connectWS(t *testing.T, wsURL, roomID, playerID string) *websocket.Conn {
	t.Helper()
	url := wsURL + "/ws/room/" + roomID + "?player_id=" + playerID
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("failed to connect websocket: %v", err)
	}
	return conn
}

func sendMsg(t *testing.T, conn *websocket.Conn, msg ws.ClientMessage) {
	t.Helper()
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal message: %v", err)
	}
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to send message: %v", err)
	}
}

type createRoomResp struct {
	RoomID   string `json:"room_id"`
	PlayerID string `json:"player_id"`
}

func TestFullGameFlow_BothPlayersFinish(t *testing.T) {
	server, wsURL := setupServer(t)
	defer server.Close()

	resp, err := http.Post(server.URL+"/api/rooms", "application/json", nil)
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}
	var createResp createRoomResp
	json.NewDecoder(resp.Body).Decode(&createResp)
	resp.Body.Close()

	if createResp.RoomID == "" {
		t.Fatal("expected room_id in response")
	}
	t.Logf("Created room: %s", createResp.RoomID)

	secondPlayerID := "integration-test-player-2"
	hostConn := connectWS(t, wsURL, createResp.RoomID, createResp.PlayerID)
	secondConn := connectWS(t, wsURL, createResp.RoomID, secondPlayerID)

	hostClient := newSafeWS(hostConn)
	secondClient := newSafeWS(secondConn)
	t.Cleanup(func() { hostClient.close(); secondClient.close() })

	// Join sequentially
	sendMsg(t, hostConn, ws.ClientMessage{Type: "join", PlayerName: "Host"})
	hostClient.waitFor(t, "player_list", 2*time.Second)
	sendMsg(t, secondConn, ws.ClientMessage{Type: "join", PlayerName: "Guest"})
	secondClient.waitFor(t, "player_list", 2*time.Second)
	hostClient.waitFor(t, "player_joined", 2*time.Second)
	t.Log("Both players joined successfully")

	// Start game
	sendMsg(t, hostConn, ws.ClientMessage{Type: "start_game"})
	hostGameStart := hostClient.waitFor(t, "game_start", 2*time.Second)
	secondClient.waitFor(t, "game_start", 2*time.Second)

	if hostGameStart.Text == "" {
		t.Fatal("expected game text in host's game_start")
	}
	gameText := hostGameStart.Text
	t.Logf("Game started with text: %q (%d chars)", gameText, len(gameText))

	// Host types 5 characters
	for i := 0; i < 5 && i < len(gameText); i++ {
		sendMsg(t, hostConn, ws.ClientMessage{
			Type:     "keystroke",
			Char:     string(gameText[i]),
			Position: i + 1,
		})
		time.Sleep(10 * time.Millisecond)
	}

	// Guest should receive progress messages from host up to position 5
	secondClient.waitForCondition(t, func(msgs []ws.ServerMessage) bool {
		p := secondClient.lastProgressFor(createResp.PlayerID)
		return p != nil && p.Position >= 5
	}, "guest receives host progress up to position 5", 2*time.Second)

	hostProgress := secondClient.lastProgressFor(createResp.PlayerID)
	if hostProgress == nil {
		t.Fatal("expected guest to receive progress messages for host")
	}
	t.Logf("Guest received host progress up to position %d", hostProgress.Position)

	// Guest types 3 characters
	for i := 0; i < 3 && i < len(gameText); i++ {
		sendMsg(t, secondConn, ws.ClientMessage{
			Type:     "keystroke",
			Char:     string(gameText[i]),
			Position: i + 1,
		})
		time.Sleep(10 * time.Millisecond)
	}

	// Host should receive progress from guest
	hostClient.waitForCondition(t, func(msgs []ws.ServerMessage) bool {
		return hostClient.hasProgressFrom(secondPlayerID)
	}, "host receives guest progress", 2*time.Second)
	t.Log("Host receives enemy preview progress for guest")

	// Host finishes the game
	for i := 5; i < len(gameText); i++ {
		sendMsg(t, hostConn, ws.ClientMessage{
			Type:     "keystroke",
			Char:     string(gameText[i]),
			Position: i + 1,
		})
	}

	// Guest should receive player_finished notification
	hostFinished := secondClient.waitFor(t, "player_finished", 2*time.Second)
	if hostFinished.PlayerFinished == nil {
		t.Fatal("expected player_finished to have PlayerInfo")
	}
	if hostFinished.PlayerFinished.Name != "Host" {
		t.Errorf("expected finished player name 'Host', got %q", hostFinished.PlayerFinished.Name)
	}
	t.Log("Toast notification (player_finished) received by guest")

	// Guest also finishes
	for i := 3; i < len(gameText); i++ {
		sendMsg(t, secondConn, ws.ClientMessage{
			Type:     "keystroke",
			Char:     string(gameText[i]),
			Position: i + 1,
		})
	}

	// Both should receive game_over
	hostGameOver := hostClient.waitFor(t, "game_over", 2*time.Second)
	secondGameOver := secondClient.waitFor(t, "game_over", 2*time.Second)

	if len(hostGameOver.Results) != 2 {
		t.Errorf("expected 2 results in host's game_over, got %d", len(hostGameOver.Results))
	}
	if len(secondGameOver.Results) != 2 {
		t.Errorf("expected 2 results in guest's game_over, got %d", len(secondGameOver.Results))
	}
	t.Log("Game over received by both players")

	if hostGameOver.Winner != createResp.PlayerID {
		t.Errorf("expected winner to be host (%s), got %s", createResp.PlayerID, hostGameOver.Winner)
	}
	t.Logf("Winner correctly identified: %s", hostGameOver.Winner)
}

func TestProgressBroadcastToOpponent(t *testing.T) {
	server, wsURL := setupServer(t)
	defer server.Close()

	resp, err := http.Post(server.URL+"/api/rooms", "application/json", nil)
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}
	var createResp createRoomResp
	json.NewDecoder(resp.Body).Decode(&createResp)
	resp.Body.Close()

	p2ID := "progress-test-p2"
	hostConn := connectWS(t, wsURL, createResp.RoomID, createResp.PlayerID)
	p2Conn := connectWS(t, wsURL, createResp.RoomID, p2ID)

	hostClient := newSafeWS(hostConn)
	p2Client := newSafeWS(p2Conn)
	t.Cleanup(func() { hostClient.close(); p2Client.close() })

	// Join sequentially
	sendMsg(t, hostConn, ws.ClientMessage{Type: "join", PlayerName: "Host"})
	hostClient.waitFor(t, "player_list", 2*time.Second)
	sendMsg(t, p2Conn, ws.ClientMessage{Type: "join", PlayerName: "P2"})
	p2Client.waitFor(t, "player_list", 2*time.Second)
	hostClient.waitFor(t, "player_joined", 2*time.Second)

	// Start game
	sendMsg(t, hostConn, ws.ClientMessage{Type: "start_game"})
	gameStart := hostClient.waitFor(t, "game_start", 2*time.Second)
	p2Client.waitFor(t, "game_start", 2*time.Second)
	gameText := gameStart.Text

	// Host sends keystroke at position 10
	sendMsg(t, hostConn, ws.ClientMessage{
		Type:     "keystroke",
		Char:     string(gameText[0]),
		Position: 10,
	})

	p2Client.waitForCondition(t, func(msgs []ws.ServerMessage) bool {
		return p2Client.hasProgressFrom(createResp.PlayerID)
	}, "P2 receives host progress", 2*time.Second)

	hostProgress := p2Client.lastProgressFor(createResp.PlayerID)
	if hostProgress == nil || hostProgress.Position != 10 {
		t.Errorf("P2 did not receive progress message with position 10 from host, got %v", hostProgress)
	}

	// P2 sends keystroke
	sendMsg(t, p2Conn, ws.ClientMessage{
		Type:     "keystroke",
		Char:     string(gameText[0]),
		Position: 5,
	})

	hostClient.waitForCondition(t, func(msgs []ws.ServerMessage) bool {
		return hostClient.hasProgressFrom(p2ID)
	}, "host receives P2 progress", 2*time.Second)

	p2Progress := hostClient.lastProgressFor(p2ID)
	if p2Progress == nil || p2Progress.Position != 5 {
		t.Errorf("Host did not receive progress message with position 5 from P2, got %v", p2Progress)
	}

	t.Log("Progress broadcast verified in both directions")
}

func TestPlayerFinishedNotification(t *testing.T) {
	server, wsURL := setupServer(t)
	defer server.Close()

	resp, err := http.Post(server.URL+"/api/rooms", "application/json", nil)
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}
	var createResp createRoomResp
	json.NewDecoder(resp.Body).Decode(&createResp)
	resp.Body.Close()

	p2ID := "finish-test-p2"
	hostConn := connectWS(t, wsURL, createResp.RoomID, createResp.PlayerID)
	p2Conn := connectWS(t, wsURL, createResp.RoomID, p2ID)

	hostClient := newSafeWS(hostConn)
	p2Client := newSafeWS(p2Conn)
	t.Cleanup(func() { hostClient.close(); p2Client.close() })

	// Join sequentially
	sendMsg(t, hostConn, ws.ClientMessage{Type: "join", PlayerName: "Host"})
	hostClient.waitFor(t, "player_list", 2*time.Second)
	sendMsg(t, p2Conn, ws.ClientMessage{Type: "join", PlayerName: "P2"})
	p2Client.waitFor(t, "player_list", 2*time.Second)
	hostClient.waitFor(t, "player_joined", 2*time.Second)

	// Start game
	sendMsg(t, hostConn, ws.ClientMessage{Type: "start_game"})
	gameStart := hostClient.waitFor(t, "game_start", 2*time.Second)
	p2Client.waitFor(t, "game_start", 2*time.Second)
	gameText := gameStart.Text

	// Host finishes the entire text
	for i := 0; i < len(gameText); i++ {
		sendMsg(t, hostConn, ws.ClientMessage{
			Type:     "keystroke",
			Char:     string(gameText[i]),
			Position: i + 1,
		})
	}

	// P2 should receive player_finished
	finishedMsg := p2Client.waitFor(t, "player_finished", 2*time.Second)
	if finishedMsg.PlayerFinished == nil {
		t.Fatal("expected player_finished to have PlayerInfo")
	}
	if finishedMsg.PlayerFinished.Name != "Host" {
		t.Errorf("expected finished player name 'Host', got %q", finishedMsg.PlayerFinished.Name)
	}

	// Verify P2 did NOT get game_over yet
	gameOverCount := p2Client.countMessages("game_over")
	if gameOverCount != 0 {
		t.Errorf("expected 0 game_over messages (game not complete), got %d", gameOverCount)
	}

	t.Log("Player finished notification verified - toast would appear, game continues")
}

func TestTimerContinuesAfterNotification(t *testing.T) {
	server, wsURL := setupServer(t)
	defer server.Close()

	resp, err := http.Post(server.URL+"/api/rooms", "application/json", nil)
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}
	var createResp createRoomResp
	json.NewDecoder(resp.Body).Decode(&createResp)
	resp.Body.Close()

	p2ID := "timer-test-p2"
	hostConn := connectWS(t, wsURL, createResp.RoomID, createResp.PlayerID)
	p2Conn := connectWS(t, wsURL, createResp.RoomID, p2ID)

	hostClient := newSafeWS(hostConn)
	p2Client := newSafeWS(p2Conn)
	t.Cleanup(func() { hostClient.close(); p2Client.close() })

	// Join sequentially
	sendMsg(t, hostConn, ws.ClientMessage{Type: "join", PlayerName: "Host"})
	hostClient.waitFor(t, "player_list", 2*time.Second)
	sendMsg(t, p2Conn, ws.ClientMessage{Type: "join", PlayerName: "P2"})
	p2Client.waitFor(t, "player_list", 2*time.Second)
	hostClient.waitFor(t, "player_joined", 2*time.Second)

	// Start game
	sendMsg(t, hostConn, ws.ClientMessage{Type: "start_game"})
	hostGameStart := hostClient.waitFor(t, "game_start", 2*time.Second)
	p2Client.waitFor(t, "game_start", 2*time.Second)
	gameText := hostGameStart.Text

	// Host finishes
	for i := 0; i < len(gameText); i++ {
		sendMsg(t, hostConn, ws.ClientMessage{
			Type:     "keystroke",
			Char:     string(gameText[i]),
			Position: i + 1,
		})
	}

	// P2 should receive player_finished
	p2Client.waitFor(t, "player_finished", 2*time.Second)

	// Verify no game_over yet
	gameOverCount := p2Client.countMessages("game_over")
	if gameOverCount != 0 {
		t.Errorf("expected no game_over yet, got %d", gameOverCount)
	}

	// P2 can still send keystrokes (game is still running)
	sendMsg(t, p2Conn, ws.ClientMessage{
		Type:     "keystroke",
		Char:     string(gameText[0]),
		Position: 1,
	})

	// Host should receive P2's progress (game still active)
	hostClient.waitForCondition(t, func(msgs []ws.ServerMessage) bool {
		return hostClient.hasProgressFrom(p2ID)
	}, "host receives P2 progress after notification", 2*time.Second)
	t.Log("Game still active - host receives progress from P2 after notification")

	// P2 finishes too
	for i := 1; i < len(gameText); i++ {
		sendMsg(t, p2Conn, ws.ClientMessage{
			Type:     "keystroke",
			Char:     string(gameText[i]),
			Position: i + 1,
		})
	}

	// Now game_over should arrive
	hostClient.waitFor(t, "game_over", 2*time.Second)
	t.Log("Timer continues running after notification - game completes when both finish")
}

func TestTimeoutGameEnd(t *testing.T) {
	server, wsURL := setupServer(t)
	defer server.Close()

	resp, err := http.Post(server.URL+"/api/rooms", "application/json", nil)
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}
	var createResp createRoomResp
	json.NewDecoder(resp.Body).Decode(&createResp)
	resp.Body.Close()

	p2ID := "timeout-test-p2"
	hostConn := connectWS(t, wsURL, createResp.RoomID, createResp.PlayerID)
	p2Conn := connectWS(t, wsURL, createResp.RoomID, p2ID)

	hostClient := newSafeWS(hostConn)
	p2Client := newSafeWS(p2Conn)
	t.Cleanup(func() { hostClient.close(); p2Client.close() })

	// Join sequentially
	sendMsg(t, hostConn, ws.ClientMessage{Type: "join", PlayerName: "Host"})
	hostClient.waitFor(t, "player_list", 2*time.Second)
	sendMsg(t, p2Conn, ws.ClientMessage{Type: "join", PlayerName: "P2"})
	p2Client.waitFor(t, "player_list", 2*time.Second)
	hostClient.waitFor(t, "player_joined", 2*time.Second)

	// Start game
	sendMsg(t, hostConn, ws.ClientMessage{Type: "start_game"})
	gameStartMsg := hostClient.waitFor(t, "game_start", 2*time.Second)
	p2Client.waitFor(t, "game_start", 2*time.Second)
	gameText := gameStartMsg.Text

	// Both type a little but don't finish
	sendMsg(t, hostConn, ws.ClientMessage{
		Type:     "keystroke",
		Char:     string(gameText[0]),
		Position: 5,
	})
	sendMsg(t, p2Conn, ws.ClientMessage{
		Type:     "keystroke",
		Char:     string(gameText[0]),
		Position: 3,
	})

	// Wait for timeout (31 seconds from game start)
	t.Log("Waiting for game timeout (31 seconds)...")
	hostGameOver := hostClient.waitFor(t, "game_over", 35*time.Second)
	secondGameOver := p2Client.waitFor(t, "game_over", 5*time.Second)

	if len(hostGameOver.Results) != 2 {
		t.Errorf("expected 2 results in timeout game_over, got %d", len(hostGameOver.Results))
	}
	if len(secondGameOver.Results) != 2 {
		t.Errorf("expected 2 results in timeout game_over for second player, got %d", len(secondGameOver.Results))
	}

	t.Logf("Timeout game over received. Winner: %q", hostGameOver.Winner)
	t.Log("Game ends at 30s timeout verified")
}
