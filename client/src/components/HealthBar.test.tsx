import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import HealthBar from './HealthBar'

describe('HealthBar', () => {
  it('displays player name', () => {
    render(<HealthBar name="Player1" hp={1000} maxHp={1000} />)
    expect(screen.getByText('Player1')).toBeInTheDocument()
  })

  it('displays HP value', () => {
    render(<HealthBar name="Player1" hp={750} maxHp={1000} />)
    expect(screen.getByText('750 / 1000')).toBeInTheDocument()
  })

  it('renders HP bar', () => {
    render(<HealthBar name="Player1" hp={500} maxHp={1000} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
  })

  it('shows different colors based on HP percentage', () => {
    const { rerender } = render(<HealthBar name="Player1" hp={900} maxHp={1000} />)
    let bar = screen.getByRole('progressbar')
    expect(bar).toHaveClass('bg-green-500')

    rerender(<HealthBar name="Player1" hp={400} maxHp={1000} />)
    bar = screen.getByRole('progressbar')
    expect(bar).toHaveClass('bg-yellow-500')

    rerender(<HealthBar name="Player1" hp={100} maxHp={1000} />)
    bar = screen.getByRole('progressbar')
    expect(bar).toHaveClass('bg-red-500')
  })
})