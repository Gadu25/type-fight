package game

import (
	"math/rand"
	"time"
)

var phrasePools = map[string][]string{
	"grunt": {
		"The sword shines bright",
		"Fire burns through darkness",
		"Strike fast and true",
		"The blade catches light",
		"Steel sings through air",
		"Swift as the wind",
		"Precision cuts deep",
		"Aim true strike hard",
	},
	"archer": {
		"The warrior entered the ancient battlefield with courage and honor",
		"Magic flows through the veins of the forgotten forest at dawn",
		"The knight raised his sword and charged into the heart of battle",
		"Shadows dance across the moonlit battlefield as arrows fly",
		"The ancient stones hold secrets of battles fought long ago",
	},
	"paladin": {
		"The forgotten kingdom was protected by ancient warriors who fought without fear",
		"Darkness spread across the land as the dragon descended from the mountain peaks",
		"The iron fortress stood tall against the endless tide of invaders seeking glory",
		"Thunder roared across the sky as the armies clashed beneath the storm",
	},
	"wizard": {
		"The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon",
		"When the final battle began the warriors knew there was no turning back from the path they had chosen",
		"The legendary sword was forged in dragon fire and quenched in the tears of a thousand fallen heroes",
	},
	"cleric": {
		"Sacred light restore me",
		"Bless this wounded soul",
		"Mend the wounds within",
		"Prayer calls upon grace",
		"Heal through ancient touch",
		"Holy light mend flesh",
		"Grant me swift recovery",
		"Divine hand heals pain",
	},
	"priest": {
		"The holy light descends upon the faithful and heals all wounds",
		"Ancient prayers rise into the heavens as sacred energy restores the body",
		"Through devotion and sacrifice the wounded are made whole once more",
		"The temple bells ring out as divine power flows through healing hands",
		"Sacred scripture guides the healer as restoration magic fills the air",
	},
	"saint": {
		"The divine blessing of the celestial order descended upon the battlefield restoring life to the fallen",
		"Through years of devotion and unwavering faith the saint called upon the gods to heal the wounded warrior",
		"Sacred light poured from the heavens as the holy saint channeled ancient power to mend every broken bone and wound",
	},
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

func GetRandomPhrase(tier string) string {
	pool, exists := phrasePools[tier]
	if !exists || len(pool) == 0 {
		return ""
	}
	return pool[rand.Intn(len(pool))]
}

func GetRandomText() string {
	return GetRandomPhrase("archer")
}

func GetPhrasePools() map[string][]string {
	pools := make(map[string][]string)
	for tier, phrases := range phrasePools {
		pool := make([]string, len(phrases))
		copy(pool, phrases)
		pools[tier] = pool
	}
	return pools
}
