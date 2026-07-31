import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SpriteAnimator from './SpriteAnimator'

function mockRaf() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now() + 16), 16) as unknown as number
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
}

function loadImage(alt: string, naturalWidth: number) {
  const img = screen.getByAltText(alt) as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true })
  fireEvent.load(img)
}

beforeEach(() => {
  vi.useFakeTimers()
  mockRaf()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SpriteAnimator', () => {
  it('auto-detects frame count from the loaded image width', () => {
    render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    loadImage('Grunt', 640)
    expect(screen.getByAltText('Grunt')).toHaveStyle('width: 640px')
  })

  it('resets the frame count when the src changes', () => {
    const { rerender } = render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    loadImage('Grunt', 640)
    expect(screen.getByAltText('Grunt')).toHaveStyle('width: 640px')
    rerender(<SpriteAnimator src="/sprites/grunt/attack1.png" alt="Grunt" duration={700} mode="once" />)
    expect(screen.getByAltText('Grunt')).toHaveStyle('width: 128px')
  })

  it('uses a single frame width when the image is sub-frame', () => {
    render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    loadImage('Grunt', 100)
    expect(screen.getByAltText('Grunt')).toHaveStyle('width: 128px')
  })

  it('fires onComplete once in once mode', () => {
    const onComplete = vi.fn()
    render(<SpriteAnimator src="/sprites/grunt/attack1.png" alt="Grunt" duration={500} mode="once" onComplete={onComplete} />)
    loadImage('Grunt', 640)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('holds the last frame in hold mode without firing onComplete', () => {
    const onComplete = vi.fn()
    render(<SpriteAnimator src="/sprites/grunt/dead.png" alt="Grunt" duration={500} mode="hold" onComplete={onComplete} />)
    loadImage('Grunt', 640)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByAltText('Grunt')).toHaveStyle('transform: translateX(-512px)')
  })

  it('detects frames for an already-loaded cached image without a load event', () => {
    const origComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete')
    const origNatural = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth')
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get() { return true } })
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get() { return 768 } })
    try {
      render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
      expect(screen.getByAltText('Grunt')).toHaveStyle('width: 768px')
      expect(screen.getByAltText('Grunt')).toHaveStyle('opacity: 1')
    } finally {
      if (origComplete) Object.defineProperty(HTMLImageElement.prototype, 'complete', origComplete)
      if (origNatural) Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', origNatural)
    }
  })

  it('lets the sheet overflow so the container crops to a single frame', () => {
    render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    const img = screen.getByAltText('Grunt') as HTMLImageElement
    Object.defineProperty(img, 'naturalWidth', { value: 768, configurable: true })
    fireEvent.load(img)
    const loaded = screen.getByAltText('Grunt') as HTMLImageElement
    expect(loaded.style.width).toBe('768px')
    expect(loaded.style.maxWidth).toBe('none')
    expect(loaded.style.transform).toBe('translateX(0px)')
  })

  it('loops in loop mode', () => {
    render(<SpriteAnimator src="/sprites/grunt/idle.png" alt="Grunt" duration={1000} mode="loop" />)
    loadImage('Grunt', 640)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByAltText('Grunt')).toHaveStyle('transform: translateX(0px)')
  })
})
