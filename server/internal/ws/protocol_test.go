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
	json.Unmarshal(data, &result)

	if result["type"] != "error" {
		t.Errorf("got type %v, want 'error'", result["type"])
	}
}
