'use client'

import { useEffect } from 'react'

interface AttackOption {
  tier: 'quick' | 'normal' | 'heavy' | 'ultimate'
  name: string
  damage: number
  shortcut: string
}

const attacks: AttackOption[] = [
  { tier: 'quick', name: 'Quick', damage: 80, shortcut: '1' },
  { tier: 'normal', name: 'Normal', damage: 180, shortcut: '2' },
  { tier: 'heavy', name: 'Heavy', damage: 350, shortcut: '3' },
  { tier: 'ultimate', name: 'Ultimate', damage: 600, shortcut: '4' },
]

interface AttackSelectorProps {
  onSelect: (tier: 'quick' | 'normal' | 'heavy' | 'ultimate') => void
  currentAttack: string
  disabled?: boolean
}

export default function AttackSelector({ onSelect, currentAttack, disabled }: AttackSelectorProps) {
  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const attack = attacks.find(a => a.shortcut === e.key)
      if (attack) {
        onSelect(attack.tier)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelect, disabled])

  return (
    <div className="flex gap-2">
      {attacks.map((attack) => (
        <button
          key={attack.tier}
          onClick={() => onSelect(attack.tier)}
          disabled={disabled}
          className={`
            px-3 py-2 rounded-lg border transition-all
            ${currentAttack === attack.tier
              ? 'bg-blue-600 border-blue-500 ring-2 ring-blue-400'
              : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="text-sm font-medium">{attack.name}</div>
          <div className="text-xs text-gray-400">{attack.damage} dmg</div>
          <div className="text-xs text-gray-500">[{attack.shortcut}]</div>
        </button>
      ))}
    </div>
  )
}
