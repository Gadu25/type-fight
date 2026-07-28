import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import RoomPage from './page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-room' }),
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />
}))

vi.mock('@/lib/ws', () => ({
  createWebSocket: vi.fn(() => ({
    readyState: 1,
    send: vi.fn(),
    close: vi.fn()
  })),
  sendMessage: vi.fn()
}))

vi.mock('@/lib/account', () => ({
  getAccount: vi.fn(() => null),
  createAccount: vi.fn(() => ({ id: 'test-id', name: 'Test', matchHistory: [] })),
  saveAccount: vi.fn(),
  updateMatchHistory: vi.fn()
}))

describe('RoomPage', () => {
  it('renders attack selector in playing state', () => {
    render(<RoomPage />)
    expect(screen.getByText('Quick')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Heavy')).toBeInTheDocument()
    expect(screen.getByText('Ultimate')).toBeInTheDocument()
  })
})
