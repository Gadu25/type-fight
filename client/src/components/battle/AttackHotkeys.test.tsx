import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AttackHotkeys from './AttackHotkeys'
import type { Team } from '@/lib/team'

const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']

describe('AttackHotkeys', () => {
  it('renders only team members with hotkey and name', () => {
    render(<AttackHotkeys team={TEAM_4} currentAttack="" onSelect={vi.fn()} />)
    expect(screen.getByText('[1]')).toBeInTheDocument()
    expect(screen.getByText('Grunt')).toBeInTheDocument()
    expect(screen.getByText('[2]')).toBeInTheDocument()
    expect(screen.getByText('Archer')).toBeInTheDocument()
    expect(screen.queryByText('Wizard')).not.toBeInTheDocument()
    expect(screen.queryByText('Saint')).not.toBeInTheDocument()
  })

  it('calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn()
    render(<AttackHotkeys team={TEAM_4} currentAttack="" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Grunt'))
    expect(onSelect).toHaveBeenCalledWith('grunt')
  })

  it('triggers onSelect via hotkeys for team members only', () => {
    const onSelect = vi.fn()
    render(<AttackHotkeys team={TEAM_4} currentAttack="" onSelect={onSelect} />)
    fireEvent.keyDown(window, { key: '1' })
    expect(onSelect).toHaveBeenCalledWith('grunt')
    fireEvent.keyDown(window, { key: '4' })
    expect(onSelect).not.toHaveBeenCalledWith('wizard')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('highlights the current attack row', () => {
    render(<AttackHotkeys team={TEAM_4} currentAttack="archer" onSelect={vi.fn()} />)
    const row = screen.getByText('Archer').closest('button')
    expect(row).toHaveClass('ring-2')
  })

  it('renders nothing for an empty team', () => {
    render(<AttackHotkeys team={[]} currentAttack="" onSelect={vi.fn()} />)
    expect(screen.queryByText('Grunt')).not.toBeInTheDocument()
  })
})
