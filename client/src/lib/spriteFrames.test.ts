import { describe, it, expect } from 'vitest'
import { getFrameIndex } from './spriteFrames'

describe('getFrameIndex', () => {
  it('returns 0 for invalid input', () => {
    expect(getFrameIndex(100, 0, 700, 'loop')).toBe(0)
    expect(getFrameIndex(100, 5, 0, 'loop')).toBe(0)
  })

  it('loops forever', () => {
    expect(getFrameIndex(0, 5, 1000, 'loop')).toBe(0)
    expect(getFrameIndex(199, 5, 1000, 'loop')).toBe(0)
    expect(getFrameIndex(200, 5, 1000, 'loop')).toBe(1)
    expect(getFrameIndex(999, 5, 1000, 'loop')).toBe(4)
    expect(getFrameIndex(1000, 5, 1000, 'loop')).toBe(0)
    expect(getFrameIndex(1200, 5, 1000, 'loop')).toBe(1)
  })

  it('once and hold clamp to the last frame past the end', () => {
    expect(getFrameIndex(999, 5, 1000, 'once')).toBe(4)
    expect(getFrameIndex(5000, 5, 1000, 'once')).toBe(4)
    expect(getFrameIndex(5000, 5, 1000, 'hold')).toBe(4)
  })
})
