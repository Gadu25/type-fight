import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AttackSelector from './AttackSelector'
import type { Team } from '@/lib/team'

const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']

describe('AttackSelector', () => {
  it('renders only the team members', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" team={TEAM_4} />)
    expect(screen.getByText('Grunt')).toBeInTheDocument()
    expect(screen.getByText('Archer')).toBeInTheDocument()
    expect(screen.getByText('Paladin')).toBeInTheDocument()
    expect(screen.getByText('Cleric')).toBeInTheDocument()
    expect(screen.queryByText('Wizard')).not.toBeInTheDocument()
    expect(screen.queryByText('Priest')).not.toBeInTheDocument()
    expect(screen.queryByText('Saint')).not.toBeInTheDocument()
  })

  it('shows damage and heal values for team members', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" team={TEAM_4} />)
    expect(screen.getByText('80 dmg')).toBeInTheDocument()
    expect(screen.getByText('180 dmg')).toBeInTheDocument()
    expect(screen.getByText('350 dmg')).toBeInTheDocument()
    expect(screen.getByText('+60 hp')).toBeInTheDocument()
    expect(screen.queryByText('600 dmg')).not.toBeInTheDocument()
    expect(screen.queryByText('+280 hp')).not.toBeInTheDocument()
  })

  it('calls onSelect when an attack button is clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" team={TEAM_4} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onSelect).toHaveBeenCalledWith('grunt')
  })

  it('calls onSelect when a heal button is clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" team={TEAM_4} />)
    fireEvent.click(screen.getByText('Cleric'))
    expect(onSelect).toHaveBeenCalledWith('cleric')
  })

  it('highlights current attack', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="archer" team={TEAM_4} />)
    const archerButton = screen.getByText('Archer').closest('button')
    expect(archerButton).toHaveClass('ring-2')
  })

  it('ignores hotkeys for tiers not in the team', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" team={TEAM_4} />)
    fireEvent.keyDown(window, { key: '1' })
    expect(onSelect).toHaveBeenCalledWith('grunt')
    fireEvent.keyDown(window, { key: '4' })
    expect(onSelect).not.toHaveBeenCalledWith('wizard')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for an empty team', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" team={[]} />)
    expect(screen.queryByText('Grunt')).not.toBeInTheDocument()
  })
})
