package game

import "testing"

func TestGetRandomPhrase_Grunt(t *testing.T) {
	phrase := GetRandomPhrase("grunt")
	if phrase == "" {
		t.Error("Expected non-empty phrase for grunt tier")
	}
}

func TestGetRandomPhrase_Archer(t *testing.T) {
	phrase := GetRandomPhrase("archer")
	if phrase == "" {
		t.Error("Expected non-empty phrase for archer tier")
	}
}

func TestGetRandomPhrase_Paladin(t *testing.T) {
	phrase := GetRandomPhrase("paladin")
	if phrase == "" {
		t.Error("Expected non-empty phrase for paladin tier")
	}
}

func TestGetRandomPhrase_Wizard(t *testing.T) {
	phrase := GetRandomPhrase("wizard")
	if phrase == "" {
		t.Error("Expected non-empty phrase for wizard tier")
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
		seen[GetRandomPhrase("grunt")] = true
	}
	if len(seen) < 2 {
		t.Error("Expected some variation in random phrases")
	}
}
