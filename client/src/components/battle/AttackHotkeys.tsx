'use client'

import { useEffect } from 'react'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { TIERS } from '@/lib/tiers'

interface AttackHotkeysProps {
  team: Team
  currentAttack: string
  onSelect: (tier: Tier) => void
  disabled?: boolean
}

export default function AttackHotkeys({ team, currentAttack, onSelect, disabled }: AttackHotkeysProps) {
  useEffect(() => {
    if (disabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const action = TIERS.find(a => a.shortcut === e.key && team.includes(a.tier))
      if (action) onSelect(action.tier)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelect, disabled, team])

  const visible = TIERS.filter(a => team.includes(a.tier))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-700/40 bg-black/40 backdrop-blur-sm p-2">
      {visible.map(a => {
        const isActive = currentAttack === a.tier
        return (
          <button
            key={a.tier}
            type="button"
            onClick={() => onSelect(a.tier)}
            disabled={disabled}
            className={`flex items-center gap-2 rounded px-2 py-1 text-left text-sm transition-all ${
              isActive
                ? 'bg-gray-700 ring-2 ring-gray-400'
                : 'bg-gray-900 hover:bg-gray-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="w-5 text-xs text-gray-400">[{a.shortcut}]</span>
            <span className="font-bold" style={{ color: a.color }}>
              {a.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
