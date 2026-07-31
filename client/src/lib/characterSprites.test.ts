import { describe, it, expect } from 'vitest'
import { CHARACTER_ANIMATIONS, getRandomAttackAnim, getMaxHurtDuration } from './characterSprites'

const TIERS = ['grunt', 'archer', 'paladin', 'wizard', 'cleric', 'priest', 'saint']
const STATES = ['idle', 'attack1', 'attack2', 'hurt', 'dead']

describe('characterSprites', () => {
  it('defines all 7 tiers with the 5 sheets at the canonical paths', () => {
    for (const tier of TIERS) {
      const anim = CHARACTER_ANIMATIONS[tier as keyof typeof CHARACTER_ANIMATIONS]
      expect(anim).toBeDefined()
      for (const state of STATES) {
        const sheet = anim[state as keyof typeof anim]
        expect(sheet.src).toBe(`/sprites/${tier}/${state}.png`)
      }
    }
  })

  it('gives every sheet a positive duration', () => {
    for (const tier of TIERS) {
      const anim = CHARACTER_ANIMATIONS[tier as keyof typeof CHARACTER_ANIMATIONS]
      for (const state of STATES) {
        expect(anim[state as keyof typeof anim].duration).toBeGreaterThan(0)
      }
    }
  })

  it('getRandomAttackAnim returns a valid attack sheet for the tier', () => {
    for (let i = 0; i < 50; i++) {
      const sheet = getRandomAttackAnim('grunt')
      expect(['/sprites/grunt/attack1.png', '/sprites/grunt/attack2.png']).toContain(sheet.src)
    }
  })

  it('getMaxHurtDuration returns the max hurt duration across the team', () => {
    expect(getMaxHurtDuration(['grunt', 'archer', 'paladin', 'cleric'])).toBe(550)
    expect(getMaxHurtDuration([])).toBe(550)
  })
})
