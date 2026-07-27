package game

import "testing"

func TestGetRandomPhrase_Quick(t *testing.T) {
	phrase := GetRandomPhrase("quick")
	if phrase == "" {
		t.Error("Expected non-empty phrase for quick tier")
	}
}

func TestGetRandomPhrase_Normal(t *testing.T) {
	phrase := GetRandomPhrase("normal")
	if phrase == "" {
		t.Error("Expected non-empty phrase for normal tier")
	}
}

func TestGetRandomPhrase_Heavy(t *testing.T) {
	phrase := GetRandomPhrase("heavy")
	if phrase == "" {
		t.Error("Expected non-empty phrase for heavy tier")
	}
}

func TestGetRandomPhrase_Ultimate(t *testing.T) {
	phrase := GetRandomPhrase("ultimate")
	if phrase == "" {
		t.Error("Expected non-empty phrase for ultimate tier")
	}
}

func TestGetRandomPhrase_InvalidTier(t *testing.T) {
	phrase := GetRandomPhrase("invalid")
	if phrase != "" {
		t.Error("Expected empty phrase for invalid tier")
	}
}

func TestGetRandomPhrase_Varies(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 20; i++ {
		seen[GetRandomPhrase("quick")] = true
	}
	if len(seen) < 2 {
		t.Error("Expected some variation in random phrases")
	}
}
