'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { TIERS, getSpritePath, type TierInfo } from '@/lib/tiers'

interface AttackSelectorProps {
  onSelect: (tier: Tier) => void
  currentAttack: string
  disabled?: boolean
  team: Team
}

export default function AttackSelector({ onSelect, currentAttack, disabled, team }: AttackSelectorProps) {
  const visibleAttacks = TIERS.filter(a => team.includes(a.tier))

  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const action = TIERS.find(a => a.shortcut === e.key && team.includes(a.tier))
      if (action) {
        onSelect(action.tier)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelect, disabled, team])

  const renderButton = (attack: TierInfo) => {
    const isSelected = currentAttack === attack.tier
    const spriteSrc = getSpritePath(attack.tier, isSelected ? 'attack' : 'idle')

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
