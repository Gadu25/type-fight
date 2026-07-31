import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import TypingArea from './TypingArea'

describe('TypingArea', () => {
  it('renders the phrase', () => {
    render(<TypingArea phrase="Hello world" onComplete={vi.fn()} />)
    const container = document.querySelector('.font-mono')
    expect(container?.textContent).toBe('Hello world')
  })

  it('advances cursor on correct keypress', () => {
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'H' })
    const chars = screen.getAllByRole('span')
    expect(chars[0]).toHaveClass('text-green-400')
  })

  it('shows error on wrong keypress', () => {
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'X' })
    const chars = screen.getAllByRole('span')
    expect(chars[0]).toHaveClass('text-red-500')
  })

  it('does not allow backspace to clear error', () => {
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'X' })
    fireEvent.keyDown(document, { key: 'Backspace' })
    const chars = screen.getAllByRole('span')
    expect(chars[0]).toHaveClass('text-red-500')
  })

  it('calls onComplete when phrase finished', () => {
    const onComplete = vi.fn()
    render(<TypingArea phrase="Hi" onComplete={onComplete} />)
    fireEvent.keyDown(document, { key: 'H' })
    fireEvent.keyDown(document, { key: 'i' })
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, total: 2 })
  })

  it('calls onStartTyping on the first keystroke', () => {
    const onStartTyping = vi.fn()
    render(<TypingArea phrase="Hi" onComplete={vi.fn()} onStartTyping={onStartTyping} />)
    fireEvent.keyDown(document, { key: 'H' })
    fireEvent.keyDown(document, { key: 'i' })
    expect(onStartTyping).toHaveBeenCalledTimes(1)
  })
})
