import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ParallaxScene from './ParallaxScene'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'

describe('ParallaxScene', () => {
  it('renders two tiled copies of every layer', () => {
    const { container } = render(<ParallaxScene battleground={BATTLEGROUNDS.battleground1} running={false} />)
    expect(container.querySelectorAll('img').length).toBe(BATTLEGROUNDS.battleground1.layers.length * 2)
  })
})
