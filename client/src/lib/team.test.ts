import { describe, it, expect, beforeEach } from 'vitest'
import { getTeam, saveTeam, isValidTeam } from './team'
import type { Team } from './team'

beforeEach(() => localStorage.clear())

describe('team persistence', () => {
  it('returns an empty team when nothing is stored', () => {
    expect(getTeam()).toEqual([])
  })

  it('round-trips a saved team', () => {
    saveTeam(['archer', 'paladin', 'wizard', 'saint'])
    expect(getTeam()).toEqual(['archer', 'paladin', 'wizard', 'saint'])
  })

  it('round-trips a partial draft', () => {
    saveTeam(['grunt', 'archer'])
    expect(getTeam()).toEqual(['grunt', 'archer'])
  })

  it('falls back to empty on corrupt JSON', () => {
    localStorage.setItem('typefight_team', 'not json')
    expect(getTeam()).toEqual([])
  })

  it('falls back to empty on invalid data', () => {
    localStorage.setItem('typefight_team', JSON.stringify(['grunt', 'grunt']))
    expect(getTeam()).toEqual([])
  })

  it('rejects save with duplicates or unknown tiers', () => {
    expect(() => saveTeam(['grunt', 'grunt'] as Team)).toThrow()
    expect(() => saveTeam(['grunt', 'nope'] as unknown as Team)).toThrow()
  })

  it('validates exactly 4 for play', () => {
    expect(isValidTeam(['grunt', 'archer', 'paladin', 'cleric'])).toBe(true)
    expect(isValidTeam(['grunt'])).toBe(false)
    expect(isValidTeam(['grunt', 'grunt', 'grunt', 'grunt'])).toBe(false)
    expect(isValidTeam('nope')).toBe(false)
  })
})
