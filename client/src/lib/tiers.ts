import type { Tier } from './words'

export interface TierInfo {
  tier: Tier
  name: string
  value: number
  isHeal: boolean
  shortcut: string
  color: string
  borderColor: string
  emoji: string
}

export const TIERS: TierInfo[] = [
  { tier: 'grunt',   name: 'Grunt',   value: 80,  isHeal: false, shortcut: '1', color: '#ef4444', borderColor: '#dc2626', emoji: '⚔️' },
  { tier: 'archer',  name: 'Archer',  value: 180, isHeal: false, shortcut: '2', color: '#22c55e', borderColor: '#16a34a', emoji: '🏹' },
  { tier: 'paladin', name: 'Paladin', value: 350, isHeal: false, shortcut: '3', color: '#3b82f6', borderColor: '#2563eb', emoji: '🛡️' },
  { tier: 'wizard',  name: 'Wizard',  value: 600, isHeal: false, shortcut: '4', color: '#a855f7', borderColor: '#9333ea', emoji: '✨' },
  { tier: 'cleric',  name: 'Cleric',  value: 60,  isHeal: true,  shortcut: '5', color: '#10b981', borderColor: '#059669', emoji: '💚' },
  { tier: 'priest',  name: 'Priest',  value: 140, isHeal: true,  shortcut: '6', color: '#06b6d4', borderColor: '#0891b2', emoji: '🌀' },
  { tier: 'saint',   name: 'Saint',   value: 280, isHeal: true,  shortcut: '7', color: '#fbbf24', borderColor: '#d97706', emoji: '👼' },
]

export const TIER_MAP: Record<Tier, TierInfo> = Object.fromEntries(
  TIERS.map(info => [info.tier, info]),
) as Record<Tier, TierInfo>

export const SPRITE_MAP: Record<Tier, string> = Object.fromEntries(
  TIERS.map(info => [info.tier, `/sprites/${info.tier}_idle.svg`]),
) as Record<Tier, string>

export function getTierInfo(tier: string | null | undefined): TierInfo | undefined {
  if (!tier) return undefined
  return TIER_MAP[tier as Tier]
}

export function getSpritePath(tier: Tier, state: 'idle' | 'attack' = 'idle'): string {
  return `/sprites/${tier}_${state}.svg`
}
