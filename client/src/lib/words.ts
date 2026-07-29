type Tier = 'quick' | 'normal' | 'heavy' | 'ultimate'

const phrasePools: Record<Tier, string[]> = {
  quick: [
    'The sword shines bright',
    'Fire burns through darkness',
    'Strike fast and true',
    'The blade catches light',
    'Steel sings through air',
    'Swift as the wind',
    'Precision cuts deep',
    'Aim true strike hard',
  ],
  normal: [
    'The warrior entered the ancient battlefield with courage and honor',
    'Magic flows through the veins of the forgotten forest at dawn',
    'The knight raised his sword and charged into the heart of battle',
    'Shadows dance across the moonlit battlefield as arrows fly',
    'The ancient stones hold secrets of battles fought long ago',
  ],
  heavy: [
    'The forgotten kingdom was protected by ancient warriors who fought without fear',
    'Darkness spread across the land as the dragon descended from the mountain peaks',
    'The iron fortress stood tall against the endless tide of invaders seeking glory',
    'Thunder roared across the sky as the armies clashed beneath the storm',
  ],
  ultimate: [
    'The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon',
    'When the final battle began the warriors knew there was no turning back from the path they had chosen',
    'The legendary sword was forged in dragon fire and quenched in the tears of a thousand fallen heroes',
  ],
}

export function getRandomPhrase(tier: Tier): string {
  const pool = phrasePools[tier]
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]
}

export function getPhrasePool(tier: Tier): string[] {
  return phrasePools[tier]
}
