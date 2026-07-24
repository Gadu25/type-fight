package game

import (
	"testing"
	"time"
)

func TestCalculateWPM(t *testing.T) {
	tests := []struct {
		name     string
		correct  int
		elapsed  time.Duration
		expected float64
	}{
		{"10 correct chars in 1 minute", 10, time.Minute, 2.0},
		{"50 correct chars in 1 minute", 50, time.Minute, 10.0},
		{"100 correct chars in 30 seconds", 100, 30 * time.Second, 40.0},
		{"50 chars finished in 15s with 4s countdown offset", 50, 15 * time.Second, 40.0},
		{"zero elapsed returns 0", 10, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateWPM(tt.correct, tt.elapsed)
			if result != tt.expected {
				t.Errorf("got %.2f, want %.2f", result, tt.expected)
			}
		})
	}
}

func TestCalculateAccuracy(t *testing.T) {
	tests := []struct {
		name     string
		correct  int
		total    int
		expected float64
	}{
		{"100% accuracy", 10, 10, 100.0},
		{"50% accuracy", 5, 10, 50.0},
		{"0% accuracy", 0, 10, 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateAccuracy(tt.correct, tt.total)
			if result != tt.expected {
				t.Errorf("got %.2f, want %.2f", result, tt.expected)
			}
		})
	}
}

func TestCheckWinner(t *testing.T) {
	tests := []struct {
		name     string
		players  []PlayerResult
		expected string
	}{
		{
			"higher WPM wins when both finished",
			[]PlayerResult{
				{ID: "p1", Finished: true, WPM: 80.0},
				{ID: "p2", Finished: true, WPM: 90.0},
			},
			"p2",
		},
		{
			"higher WPM wins even if finished later",
			[]PlayerResult{
				{ID: "p1", Finished: true, WPM: 75.0},
				{ID: "p2", Finished: true, WPM: 85.0},
			},
			"p2",
		},
		{
			"higher WPM wins when neither finished (timeout)",
			[]PlayerResult{
				{ID: "p1", Finished: false, WPM: 30.0, Accuracy: 90.0},
				{ID: "p2", Finished: false, WPM: 40.0, Accuracy: 80.0},
			},
			"p2",
		},
		{
			"tie on WPM - both win",
			[]PlayerResult{
				{ID: "p1", Finished: true, WPM: 80.0},
				{ID: "p2", Finished: true, WPM: 80.0},
			},
			"",
		},
		{
			"single player always wins",
			[]PlayerResult{
				{ID: "p1", Finished: true, WPM: 60.0},
			},
			"p1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CheckWinner(tt.players)
			if result != tt.expected {
				t.Errorf("got %s, want %s", result, tt.expected)
			}
		})
	}
}

func TestCheckTimeout(t *testing.T) {
	start := time.Now().Add(-31 * time.Second)
	if !CheckTimeout(start) {
		t.Error("expected timeout after 31 seconds")
	}

	start = time.Now().Add(-29 * time.Second)
	if CheckTimeout(start) {
		t.Error("expected no timeout after 29 seconds")
	}
}


