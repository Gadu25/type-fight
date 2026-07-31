'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import type { Team } from '@/lib/team'

type AttackTier = 'grunt' | 'archer' | 'paladin' | 'wizard' | 'cleric' | 'priest' | 'saint'

interface AttackOption {
  tier: AttackTier
  name: string
  value: number
  shortcut: string
  color: string
  borderColor: string
  isHeal: boolean
}

const attacks: AttackOption[] = [
  { tier: 'grunt',   name: 'Grunt',   value: 80,  shortcut: '1', color: '#ef4444', borderColor: '#dc2626', isHeal: false },
  { tier: 'archer',  name: 'Archer',  value: 180, shortcut: '2', color: '#22c55e', borderColor: '#16a34a', isHeal: false },
  { tier: 'paladin', name: 'Paladin', value: 350, shortcut: '3', color: '#3b82f6', borderColor: '#2563eb', isHeal: false },
  { tier: 'wizard',  name: 'Wizard',  value: 600, shortcut: '4', color: '#a855f7', borderColor: '#9333ea', isHeal: false },
  { tier: 'cleric',  name: 'Cleric',  value: 60, shortcut: '5', color: '#10b981', borderColor: '#059669', isHeal: true },
  { tier: 'priest',  name: 'Priest',  value: 140, shortcut: '6', color: '#06b6d4', borderColor: '#0891b2', isHeal: true },
  { tier: 'saint',   name: 'Saint',   value: 280, shortcut: '7', color: '#fbbf24', borderColor: '#d97706', isHeal: true },
]

interface AttackSelectorProps {
  onSelect: (tier: AttackTier) => void
  currentAttack: string
  disabled?: boolean
  team: Team
}

export default function AttackSelector({ onSelect, currentAttack, disabled, team }: AttackSelectorProps) {
  const visibleAttacks = attacks.filter(a => team.includes(a.tier))

  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const action = attacks.find(a => a.shortcut === e.key && team.includes(a.tier))
      if (action) {
        onSelect(action.tier)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelect, disabled, team])

  const renderButton = (attack: AttackOption) => {
    const isSelected = currentAttack === attack.tier
    const spriteSrc = `/sprites/${attack.tier}_${isSelected ? 'attack' : 'idle'}.svg`

    return (
      <button
        key={attack.tier}
        onClick={() => onSelect(attack.tier)}
        disabled={disabled}
        className={`
          flex flex-col items-center px-2 py-2 rounded-lg border transition-all
          ${isSelected
            ? 'bg-gray-800 ring-2'
            : 'bg-gray-900 border-gray-700 hover:bg-gray-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={isSelected ? {
          borderColor: attack.borderColor,
          boxShadow: `0 0 12px ${attack.color}55`,
          ['--tw-ring-color' as string]: attack.color,
        } : {}}
      >
        <Image
          src={spriteSrc}
          alt={attack.name}
          width={52}
          height={62}
          className="select-none"
          unoptimized
        />
        <div className="text-sm font-bold mt-1" style={{ color: attack.color }}>
          {attack.name}
        </div>
        <div className="text-xs text-gray-400">
          {attack.isHeal ? `+${attack.value} hp` : `${attack.value} dmg`}
        </div>
        <div className="text-xs text-gray-500">[{attack.shortcut}]</div>
      </button>
    )
  }

  if (visibleAttacks.length === 0) return null

  const attackTiers = visibleAttacks.filter(a => !a.isHeal)
  const healTiers = visibleAttacks.filter(a => a.isHeal)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {attackTiers.map(renderButton)}
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">heal</span>
        {healTiers.map(renderButton)}
      </div>
    </div>
  )
}
