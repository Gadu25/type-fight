import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AttackSelector from './AttackSelector'

describe('AttackSelector', () => {
  it('renders all four attack options', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" />)
    expect(screen.getByText('Quick')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Heavy')).toBeInTheDocument()
    expect(screen.getByText('Ultimate')).toBeInTheDocument()
  })

  it('shows damage values', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="" />)
    expect(screen.getByText('80 dmg')).toBeInTheDocument()
    expect(screen.getByText('180 dmg')).toBeInTheDocument()
    expect(screen.getByText('350 dmg')).toBeInTheDocument()
    expect(screen.getByText('600 dmg')).toBeInTheDocument()
  })

  it('calls onSelect when button clicked', () => {
    const onSelect = vi.fn()
    render(<AttackSelector onSelect={onSelect} currentAttack="" />)
    fireEvent.click(screen.getByText('Quick'))
    expect(onSelect).toHaveBeenCalledWith('quick')
  })

  it('highlights current attack', () => {
    render(<AttackSelector onSelect={vi.fn()} currentAttack="normal" />)
    const normalButton = screen.getByText('Normal').closest('button')
    expect(normalButton).toHaveClass('ring-2')
  })
})
