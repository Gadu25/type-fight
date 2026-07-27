package ws

import (
	"encoding/json"
	"testing"
)

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
