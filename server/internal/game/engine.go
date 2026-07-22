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

// CheckWinner determines the winner based on finish time and accuracy
// Returns empty string if tie
func CheckWinner(players []PlayerResult) string {
	if len(players) == 0 {
		return ""
	}

	// Find anyone who finished
	var finishers []PlayerResult
	for _, p := range players {
		if p.Finished {
			finishers = append(finishers, p)
		}
	}

	// If someone finished, first finisher wins
	if len(finishers) > 0 {
		earliest := finishers[0]
		for _, f := range finishers[1:] {
			if f.FinishTime.Before(earliest.FinishTime) {
				earliest = f
			}
		}
		return earliest.ID
	}

	// No finishers - highest accuracy wins
	var winner PlayerResult
	hasWinner := false
	for _, p := range players {
		if !hasWinner || p.Accuracy > winner.Accuracy {
			winner = p
			hasWinner = true
		}
	}

	// Check for tie
	tied := true
	for _, p := range players {
		if p.Accuracy != winner.Accuracy {
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
