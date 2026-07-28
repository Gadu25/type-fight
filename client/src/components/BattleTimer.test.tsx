import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleTimer from './BattleTimer'

describe('BattleTimer', () => {
  it('displays time in MM:SS format', () => {
    render(<BattleTimer timeLeft={90} />)
    expect(screen.getByText('1:30')).toBeInTheDocument()
  })

  it('displays 0:00 for zero time', () => {
    render(<BattleTimer timeLeft={0} />)
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('applies normal color for time > 30', () => {
    render(<BattleTimer timeLeft={60} />)
    const timer = screen.getByText('1:00')
    expect(timer).toHaveClass('text-white')
  })

  it('applies warning color for time <= 30', () => {
    render(<BattleTimer timeLeft={25} />)
    const timer = screen.getByText('0:25')
    expect(timer).toHaveClass('text-yellow-400')
  })

  it('applies danger color for time <= 10', () => {
    render(<BattleTimer timeLeft={5} />)
    const timer = screen.getByText('0:05')
    expect(timer).toHaveClass('text-red-500')
  })
})
