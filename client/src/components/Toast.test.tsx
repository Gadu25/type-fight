import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Toast from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message', () => {
    render(<Toast message="Enemy finished!" onDismiss={vi.fn()} />);
    expect(screen.getByText('Enemy finished!')).toBeInTheDocument();
  });

  it('calls onDismiss after duration', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Done" onDismiss={onDismiss} duration={3000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses default duration of 5000ms', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Done" onDismiss={onDismiss} />);
    act(() => { vi.advanceTimersByTime(4999); });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders null after dismiss', () => {
    render(<Toast message="Gone" onDismiss={vi.fn()} duration={1000} />);
    expect(screen.getByText('Gone')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText('Gone')).not.toBeInTheDocument();
  });

  it('cleans up timer on unmount', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast message="Bye" onDismiss={onDismiss} duration={5000} />);
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('displays a checkmark icon', () => {
    render(<Toast message="Test" onDismiss={vi.fn()} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
