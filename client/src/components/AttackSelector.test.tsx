import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AttackSelector from './AttackSelector'

describe('AttackSelector', () => {
  it('renders all seven action options', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" />)
    expect(screen.getByText('Grunt')).toBeInTheDocument()
    expect(screen.getByText('Archer')).toBeInTheDocument()
    expect(screen.getByText('Paladin')).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
    expect(screen.getByText('Cleric')).toBeInTheDocument()
    expect(screen.getByText('Priest')).toBeInTheDocument()
    expect(screen.getByText('Saint')).toBeInTheDocument()
  })

  it('shows damage and heal values', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" />)
    expect(screen.getByText('80 dmg')).toBeInTheDocument()
    expect(screen.getByText('180 dmg')).toBeInTheDocument()
    expect(screen.getByText('350 dmg')).toBeInTheDocument()
    expect(screen.getByText('600 dmg')).toBeInTheDocument()
    expect(screen.getByText('+60 hp')).toBeInTheDocument()
    expect(screen.getByText('+140 hp')).toBeInTheDocument()
    expect(screen.getByText('+280 hp')).toBeInTheDocument()
  })

  it('calls onSelect when attack button clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onSelect).toHaveBeenCalledWith('grunt')
  })

  it('calls onSelect when heal button clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" />)
    fireEvent.click(screen.getByText('Cleric'))
    expect(onSelect).toHaveBeenCalledWith('cleric')
  })

  it('highlights current attack', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="archer" />)
    const archerButton = screen.getByText('Archer').closest('button')
    expect(archerButton).toHaveClass('ring-2')
  })
})
