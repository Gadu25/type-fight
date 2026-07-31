import { describe, it, expect } from 'vitest'
import { advanceParallaxOffset, layerTranslate, PAN_SPEED } from './parallax'

describe('parallax helpers', () => {
  it('advances the offset by elapsed time', () => {
    expect(advanceParallaxOffset(0, 1000, 1920)).toBeCloseTo(1000 * PAN_SPEED)
  })

  it('grows continuously instead of wrapping at one viewport width', () => {
    expect(advanceParallaxOffset(1900, 2000, 1920)).toBe(1900 + 2000 * PAN_SPEED)
  })

  it('stays at 0 when the viewport width is invalid', () => {
    expect(advanceParallaxOffset(100, 1000, 0)).toBe(0)
  })

  it('builds a translate3d transform scaled by layer speed', () => {
    expect(layerTranslate(0, 100, 1920)).toBe('translate3d(0.00px, 0, 0)')
    expect(layerTranslate(1, 100, 1920)).toBe('translate3d(-100.00px, 0, 0)')
  })

  it('wraps each layer by exactly one viewport width for a seamless cycle', () => {
    expect(layerTranslate(0.5, 3840, 1920)).toBe('translate3d(0.00px, 0, 0)')
    expect(layerTranslate(0.5, 0, 1920)).toBe('translate3d(0.00px, 0, 0)')
  })
})
