import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import TeamPicker from './TeamPicker'
import type { Team } from '@/lib/team'

describe('TeamPicker', () => {
  it('renders all seven characters', () => {
    render(<TeamPicker team={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Grunt')).toBeInTheDocument()
    expect(screen.getByText('Archer')).toBeInTheDocument()
    expect(screen.getByText('Paladin')).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
    expect(screen.getByText('Cleric')).toBeInTheDocument()
    expect(screen.getByText('Priest')).toBeInTheDocument()
    expect(screen.getByText('Saint')).toBeInTheDocument()
  })

  it('adds a character on click', () => {
    const onChange = vi.fn()
    render(<TeamPicker team={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onChange).toHaveBeenCalledWith(['grunt'])
  })

  it('removes a selected character on click', () => {
    const onChange = vi.fn()
    render(<TeamPicker team={['grunt'] as Team} onChange={onChange} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('stops adding at 4', () => {
    const onChange = vi.fn()
    const team = ['grunt', 'archer', 'paladin', 'cleric'] as Team
    render(<TeamPicker team={team} onChange={onChange} />)
    fireEvent.click(screen.getByText('Wizard'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows order badges for selected characters', () => {
    render(<TeamPicker team={['cleric', 'grunt'] as Team} onChange={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows the pick counter', () => {
    render(<TeamPicker team={['grunt', 'archer'] as Team} onChange={vi.fn()} />)
    expect(screen.getByText(/2\/4/)).toBeInTheDocument()
  })

  it('does not toggle when disabled', () => {
    const onChange = vi.fn()
    render(<TeamPicker team={[]} onChange={onChange} disabled />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
