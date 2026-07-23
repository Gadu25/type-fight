package game

import "time"

const (
	GameTimeLimit = 30 * time.Second
	CharsPerWord  = 5
)

// CalculateWPM calculates words per minute
// Formula: correct_characters / 5 / (elapsed_time_minutes)
func CalculateWPM(correctChars int, elapsed time.Duration) float64 {
	if elapsed.Seconds() == 0 {
		return 0
	}
	minutes := elapsed.Seconds() / 60.0
	return float64(correctChars) / float64(CharsPerWord) / minutes
}

// CalculateAccuracy calculates typing accuracy as percentage
// Formula: correct_keystrokes / total_keystrokes * 100
func CalculateAccuracy(correct, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(correct) / float64(total) * 100.0
}

// PlayerResult holds a player's game result for winner determination
type PlayerResult struct {
	ID       string
	Finished bool
	WPM      float64
	Accuracy float64
}

// CheckWinner determines the winner based on WPM (typing speed).
// If both finished, higher WPM wins. If neither finished, higher WPM still wins.
// Returns empty string if WPM is tied.
func CheckWinner(players []PlayerResult) string {
	if len(players) == 0 {
		return ""
	}

	if len(players) == 1 {
		return players[0].ID
	}

	var winner PlayerResult
	hasWinner := false
	for _, p := range players {
		if !hasWinner || p.WPM > winner.WPM {
			winner = p
			hasWinner = true
		}
	}

	// Check for tie
	tied := true
	for _, p := range players {
		if p.WPM != winner.WPM {
			tied = false
			break
		}
	}

	if tied {
		return "" // Tie - both win
	}

	return winner.ID
}

// CheckTimeout checks if the game time limit has been exceeded
func CheckTimeout(startTime time.Time) bool {
	return time.Since(startTime) >= GameTimeLimit
}
