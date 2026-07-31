import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleCamera from './BattleCamera'

describe('BattleCamera', () => {
  it('sits at scale 1 centered by default', () => {
    const { container } = render(<BattleCamera focus={null}><div /></BattleCamera>)
    const div = container.firstChild as HTMLElement
    expect(div).toHaveStyle('transform: scale(1)')
    expect(div).toHaveStyle('transform-origin: 50% 50%')
  })

  it('zooms toward the focus spot', () => {
    const { container } = render(<BattleCamera focus={{ x: 0.2, y: 0.78 }}><div /></BattleCamera>)
    const div = container.firstChild as HTMLElement
    expect(div).toHaveStyle('transform: scale(1.12)')
    expect(div).toHaveStyle('transform-origin: 20% 78%')
  })
})
