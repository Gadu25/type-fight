'use client'

import Image from 'next/image'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'

interface CharacterOption {
  tier: Tier
  name: string
  value: number
  isHeal: boolean
}

const CHARACTERS: CharacterOption[] = [
  { tier: 'grunt',   name: 'Grunt',   value: 80,  isHeal: false },
  { tier: 'archer',  name: 'Archer',  value: 180, isHeal: false },
  { tier: 'paladin', name: 'Paladin', value: 350, isHeal: false },
  { tier: 'wizard',  name: 'Wizard',  value: 600, isHeal: false },
  { tier: 'cleric',  name: 'Cleric',  value: 60,  isHeal: true },
  { tier: 'priest',  name: 'Priest',  value: 140, isHeal: true },
  { tier: 'saint',   name: 'Saint',   value: 280, isHeal: true },
]

interface TeamPickerProps {
  team: Team
  onChange: (team: Team) => void
  disabled?: boolean
}

export default function TeamPicker({ team, onChange, disabled }: TeamPickerProps) {
  const toggleTier = (tier: Tier) => {
    if (disabled) return
    if (team.includes(tier)) {
      onChange(team.filter(t => t !== tier))
    } else if (team.length < 4) {
      onChange([...team, tier])
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Your Team</span>
        <span className={`text-xs ${team.length === 4 ? 'text-green-400' : 'text-gray-400'}`}>
          {team.length}/4 {team.length === 4 ? '— ready to battle' : 'pick exactly 4'}
        </span>
      </div>
      <div className={`grid grid-cols-4 gap-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {CHARACTERS.map(c => {
          const order = team.indexOf(c.tier)
          const selected = order >= 0
          return (
            <button
              key={c.tier}
              type="button"
              onClick={() => toggleTier(c.tier)}
              disabled={disabled}
              className={`relative flex flex-col items-center p-2 rounded-lg border transition-all ${
                selected ? 'bg-gray-700 border-green-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'
              }`}
            >
              {selected && (
                <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-green-500 text-black text-xs font-bold flex items-center justify-center">
                  {order + 1}
                </span>
              )}
              <Image
                src={`/sprites/${c.tier}_idle.svg`}
                alt={c.name}
                width={52}
                height={62}
                unoptimized
                className="select-none"
              />
              <div className="text-xs font-bold mt-1">{c.name}</div>
              <div className="text-xs text-gray-400">{c.isHeal ? `+${c.value} hp` : `${c.value} dmg`}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
