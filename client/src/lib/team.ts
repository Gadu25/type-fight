import type { Tier } from './words'

export type Team = Tier[]

export const DEFAULT_TEAM: Team = ['grunt', 'archer', 'paladin', 'cleric']

const STORAGE_KEY = 'typefight_team'
const TEAM_SIZE = 4

const VALID_TIERS: Tier[] = ['grunt', 'archer', 'paladin', 'wizard', 'cleric', 'priest', 'saint']

export function isValidTeam(value: unknown): value is Team {
  return (
    Array.isArray(value) &&
    value.length === TEAM_SIZE &&
    value.every(tier => VALID_TIERS.includes(tier as Tier)) &&
    new Set(value).size === TEAM_SIZE
  )
}

export function getTeam(): Team {
  if (typeof window === 'undefined') return [...DEFAULT_TEAM]
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return [...DEFAULT_TEAM]
  try {
    const parsed = JSON.parse(data)
    return isValidTeam(parsed) ? parsed : [...DEFAULT_TEAM]
  } catch {
    return [...DEFAULT_TEAM]
  }
}

export function saveTeam(team: Team): void {
  if (!isValidTeam(team)) throw new Error('Team must contain exactly 4 valid tiers')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(team))
}
