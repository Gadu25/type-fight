import { describe, it, expect } from 'vitest'
import { EFFECTS } from './effects'

describe('effects manifest', () => {
  it('defines hit and heal effects with positive durations', () => {
    expect(EFFECTS.hit.src).toBe('/effects/hit.png')
    expect(EFFECTS.hit.duration).toBeGreaterThan(0)
    expect(EFFECTS.heal.src).toBe('/effects/heal.png')
    expect(EFFECTS.heal.duration).toBeGreaterThan(0)
  })
})
