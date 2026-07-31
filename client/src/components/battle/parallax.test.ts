import { describe, it, expect } from 'vitest'
import { advanceParallaxOffset, layerTranslate, PAN_SPEED } from './parallax'

describe('parallax helpers', () => {
  it('advances the offset by elapsed time', () => {
    expect(advanceParallaxOffset(0, 1000, 1920)).toBeCloseTo(1000 * PAN_SPEED)
  })

  it('wraps at one viewport width', () => {
    const next = advanceParallaxOffset(1900, 2000, 1920)
    expect(next).toBeGreaterThanOrEqual(0)
    expect(next).toBeLessThan(1920)
  })

  it('stays at 0 when the viewport width is invalid', () => {
    expect(advanceParallaxOffset(100, 1000, 0)).toBe(0)
  })

  it('builds a translate3d transform scaled by layer speed', () => {
    expect(layerTranslate(0, 100)).toBe('translate3d(0.00px, 0, 0)')
    expect(layerTranslate(1, 100)).toBe('translate3d(-100.00px, 0, 0)')
  })
})
