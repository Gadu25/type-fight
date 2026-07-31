import type { Tier } from './words'

export type Team = Tier[]

const STORAGE_KEY = 'typefight_team'
const TEAM_SIZE = 4

const VALID_TIERS: Tier[] = ['grunt', 'archer', 'paladin', 'wizard', 'cleric', 'priest', 'saint']

export function isValidTeamDraft(value: unknown): value is Team {
  if (!Array.isArray(value) || value.length > TEAM_SIZE) return false
  return (
    value.every(tier => VALID_TIERS.includes(tier as Tier)) &&
    new Set(value).size === value.length
  )
}

export function isValidTeam(value: unknown): value is Team {
  return Array.isArray(value) && value.length === TEAM_SIZE && isValidTeamDraft(value)
}

export function getTeam(): Team {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return []
  try {
    const parsed = JSON.parse(data)
    return isValidTeamDraft(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTeam(team: Team): void {
  if (!isValidTeamDraft(team)) throw new Error('Team must contain valid tiers, no duplicates, at most 4')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(team))
}
