package game

import (
	"math/rand"
	"time"
)

var wordPool = []string{
	"the quick brown fox jumps over the lazy dog",
	"a journey of a thousand miles begins with a single step",
	"to be or not to be that is the question",
	"all that glitters is not gold",
	"the only thing we have to fear is fear itself",
	"in the middle of difficulty lies opportunity",
	"life is what happens when you are busy making other plans",
	"the way to get started is to quit talking and begin doing",
	"if life were predictable it would cease to be life",
	"spread love everywhere you go let no one ever come to you without leaving happier",
	"always remember that you are absolutely unique just like everyone else",
	"the greatest glory in living lies not in never falling but in rising every time we fall",
	"tell me and i forget teach me and i remember involve me and i learn",
	"the future belongs to those who believe in the beauty of their dreams",
	"it is during our darkest moments that we must focus to see the light",
	"whoever is happy will make others happy too",
	"do not go where the path may lead go instead where there is no path and leave a trail",
	"you will face many defeats in life but never let yourself be defeated",
	"never let the fear of striking out keep you from playing the game",
	"the purpose of our lives is to be happy",
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

// GetRandomText returns a random sentence from the word pool
func GetRandomText() string {
	return wordPool[rand.Intn(len(wordPool))]
}
