package ws

import (
	"encoding/json"
	"testing"
)

func TestClientMessageUnmarshal(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantType string
	}{
		{"join message", `{"type":"join","player_name":"Alex"}`, "join"},
		{"ready message", `{"type":"ready"}`, "ready"},
		{"start_game message", `{"type":"start_game"}`, "start_game"},
		{"keystroke message", `{"type":"keystroke","char":"a","position":5}`, "keystroke"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var msg ClientMessage
			err := json.Unmarshal([]byte(tt.input), &msg)
			if err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}
			if msg.Type != tt.wantType {
				t.Errorf("got type %s, want %s", msg.Type, tt.wantType)
			}
		})
	}
}

func TestServerMessageMarshal(t *testing.T) {
	msg := ServerMessage{
		Type: "error",
		Error: &ErrorMessage{Message: "Room is full"},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if result["type"] != "error" {
		t.Errorf("got type %v, want 'error'", result["type"])
	}

	errMap, ok := result["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'error' to be an object, got %T", result["error"])
	}
	if errMap["message"] != "Room is full" {
		t.Errorf("got error.message %v, want 'Room is full'", errMap["message"])
	}
}

func TestCombatClientMessage_SelectAttack(t *testing.T) {
	msg := CombatClientMessage{
		Type: "select_attack",
		SelectAttack: &SelectAttackPayload{
			Tier: "quick",
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}
	var decoded CombatClientMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if decoded.Type != "select_attack" {
		t.Errorf("Expected type 'select_attack', got '%s'", decoded.Type)
	}
	if decoded.SelectAttack.Tier != "quick" {
		t.Errorf("Expected tier 'quick', got '%s'", decoded.SelectAttack.Tier)
	}
}

func TestCombatClientMessage_AttackComplete(t *testing.T) {
	msg := CombatClientMessage{
		Type: "attack_complete",
		AttackComplete: &AttackCompletePayload{
			Correct: 50,
			Total:   60,
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}
	var decoded CombatClientMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if decoded.Type != "attack_complete" {
		t.Errorf("Expected type 'attack_complete', got '%s'", decoded.Type)
	}
	if decoded.AttackComplete.Correct != 50 {
		t.Errorf("Expected correct 50, got %d", decoded.AttackComplete.Correct)
	}
	if decoded.AttackComplete.Total != 60 {
		t.Errorf("Expected total 60, got %d", decoded.AttackComplete.Total)
	}
}

func TestCombatServerMessage_AttackPhrase(t *testing.T) {
	msg := CombatServerMessage{
		Type: "attack_phrase",
		AttackPhrase: &AttackPhrasePayload{
			Phrase: "The sword shines bright",
			Tier:   "quick",
			Damage: 80,
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}
	var decoded CombatServerMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if decoded.Type != "attack_phrase" {
		t.Errorf("Expected type 'attack_phrase', got '%s'", decoded.Type)
	}
	if decoded.AttackPhrase.Phrase != "The sword shines bright" {
		t.Errorf("Expected phrase 'The sword shines bright', got '%s'", decoded.AttackPhrase.Phrase)
	}
}

func TestCombatServerMessage_HpUpdate(t *testing.T) {
	msg := CombatServerMessage{
		Type: "hp_update",
		HpUpdate: &HpUpdatePayload{
			PlayerID: "player1",
			HP:       920,
			Attacker: "player2",
			Damage:   80,
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}
	var decoded CombatServerMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if decoded.Type != "hp_update" {
		t.Errorf("Expected type 'hp_update', got '%s'", decoded.Type)
	}
	if decoded.HpUpdate.HP != 920 {
		t.Errorf("Expected HP 920, got %d", decoded.HpUpdate.HP)
	}
}
