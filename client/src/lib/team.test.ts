import { describe, it, expect, beforeEach } from 'vitest'
import { getTeam, saveTeam, isValidTeam, DEFAULT_TEAM } from './team'

beforeEach(() => localStorage.clear())

describe('team persistence', () => {
  it('returns the default team when nothing is stored', () => {
    expect(getTeam()).toEqual(DEFAULT_TEAM)
  })

  it('round-trips a saved team', () => {
    saveTeam(['archer', 'paladin', 'wizard', 'saint'])
    expect(getTeam()).toEqual(['archer', 'paladin', 'wizard', 'saint'])
  })

  it('falls back to default on corrupt JSON', () => {
    localStorage.setItem('typefight_team', 'not json')
    expect(getTeam()).toEqual(DEFAULT_TEAM)
  })

  it('falls back to default on an invalid team', () => {
    localStorage.setItem('typefight_team', JSON.stringify(['grunt', 'archer']))
    expect(getTeam()).toEqual(DEFAULT_TEAM)
  })

  it('validates a team shape', () => {
    expect(isValidTeam(['grunt', 'archer', 'paladin', 'cleric'])).toBe(true)
    expect(isValidTeam(['grunt'])).toBe(false)
    expect(isValidTeam(['grunt', 'grunt', 'grunt', 'grunt'])).toBe(false)
    expect(isValidTeam('nope')).toBe(false)
  })
})
