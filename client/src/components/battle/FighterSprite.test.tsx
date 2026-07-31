import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import FighterSprite from './FighterSprite'

describe('FighterSprite', () => {
  it('renders the fighter image', () => {
    render(<FighterSprite src="/sprites/grunt_idle.svg" alt="Grunt" active={false} />)
    const img = screen.getByAltText('Grunt')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/sprites/grunt_idle.svg')
    expect(img).toHaveAttribute('draggable', 'false')
  })

  it('shows the active highlight ring', () => {
    const { container } = render(<FighterSprite src="/sprites/grunt_idle.svg" alt="Grunt" active />)
    expect(container.querySelector('img')).toHaveStyle('outline: 3px solid #fbbf24')
  })
})
