package game

import "math/rand"

var battlegrounds = []string{"battleground1"}

func GetRandomBattleground() string {
	return battlegrounds[rand.Intn(len(battlegrounds))]
}
