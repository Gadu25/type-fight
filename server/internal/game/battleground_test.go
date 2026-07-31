package game

import "testing"

func TestGetRandomBattleground_ReturnsKnown(t *testing.T) {
	for i := 0; i < 50; i++ {
		bg := GetRandomBattleground()
		found := false
		for _, known := range battlegrounds {
			if bg == known {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("unexpected battleground %q", bg)
		}
	}
}

func TestBattlegrounds_NonEmpty(t *testing.T) {
	if len(battlegrounds) == 0 {
		t.Fatal("battlegrounds list must not be empty")
	}
}
