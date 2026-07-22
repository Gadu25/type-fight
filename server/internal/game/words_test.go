package game

import (
	"testing"
)

func TestGetRandomText(t *testing.T) {
	text1 := GetRandomText()
	text2 := GetRandomText()

	if text1 == "" {
		t.Error("expected non-empty text")
	}

	if len(text1) < 10 {
		t.Error("expected text longer than 10 characters")
	}

	// Not guaranteed to be different, but very likely
	// This is a soft check
	t.Logf("Got text: %s", text1)
	t.Logf("Got text: %s", text2)
}

func TestWordPoolSize(t *testing.T) {
	if len(wordPool) < 20 {
		t.Errorf("expected at least 20 words in pool, got %d", len(wordPool))
	}
}
