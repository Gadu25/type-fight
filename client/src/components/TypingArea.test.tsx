import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import TypingArea from './TypingArea';

describe('TypingArea', () => {
  const defaultProps = {
    text: 'hello world',
    onKeystroke: vi.fn(),
    isActive: true,
    currentPosition: 0,
  };

  it('renders the full text as individual characters', () => {
    render(<TypingArea {...defaultProps} />);
    const container = document.querySelector('.whitespace-pre-wrap');
    expect(container?.textContent).toBe('hello world');
  });

  it('highlights upcoming text in gray', () => {
    render(<TypingArea {...defaultProps} />);
    const spans = document.querySelectorAll('span');
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].className).toContain('text-gray-500');
    }
  });

  it('highlights typed characters in green', () => {
    render(<TypingArea {...defaultProps} currentPosition={3} />);
    const spans = document.querySelectorAll('span');
    for (let i = 0; i < 3; i++) {
      expect(spans[i].className).toContain('text-green-400');
    }
  });

  it('highlights current position character with bg-gray-700', () => {
    render(<TypingArea {...defaultProps} currentPosition={5} />);
    const spans = document.querySelectorAll('span');
    expect(spans[5].className).toContain('bg-gray-700');
  });

  it('calls onKeystroke when correct key is pressed', () => {
    const onKeystroke = vi.fn();
    render(<TypingArea {...defaultProps} onKeystroke={onKeystroke} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'h' });
    expect(onKeystroke).toHaveBeenCalledWith('h', 1);
  });

  it('does not call onKeystroke when incorrect key is pressed', () => {
    const onKeystroke = vi.fn();
    render(<TypingArea {...defaultProps} onKeystroke={onKeystroke} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'x' });
    expect(onKeystroke).not.toHaveBeenCalled();
  });

  it('focuses input when isActive becomes true', () => {
    const { rerender } = render(
      <TypingArea {...defaultProps} isActive={false} />
    );
    const input = screen.getByRole('textbox');
    expect(document.activeElement).not.toBe(input);

    rerender(<TypingArea {...defaultProps} isActive={true} />);
    expect(document.activeElement).toBe(input);
  });

  it('disables input when isActive is false', () => {
    render(<TypingArea {...defaultProps} isActive={false} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('shows correct placeholder based on isActive', () => {
    const { rerender } = render(
      <TypingArea {...defaultProps} isActive={true} />
    );
    expect(screen.getByPlaceholderText('Start typing...')).toBeTruthy();

    rerender(<TypingArea {...defaultProps} isActive={false} />);
    expect(screen.getByPlaceholderText('Waiting for game to start...')).toBeTruthy();
  });
});
