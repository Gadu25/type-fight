import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleStage, { resolveFocusSpot } from './BattleStage'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'

const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']

function renderStage(overrides: Record<string, unknown> = {}) {
  return render(
    <BattleStage
      battleground={BATTLEGROUNDS.battleground1}
      playerTeam={TEAM_4}
      opponentTeam={TEAM_4}
      activePlayerTier={null}
      activeOpponentTier={null}
      cameraMode="wide"
      playerHP={1000}
      opponentHP={1000}
      opponentAttackKey={0}
      {...overrides}
    />,
  )
}

function loadAllImages() {
  for (const img of screen.getAllByRole('img')) {
    Object.defineProperty(img, 'naturalWidth', { value: 512, configurable: true })
    fireEvent.load(img)
  }
}

describe('BattleStage', () => {
  it('renders both 4-member teams', () => {
    renderStage()
    loadAllImages()
    expect(screen.getAllByAltText(/grunt|archer|paladin|cleric/)).toHaveLength(8)
  })

  it('plays a random attack on the active player tier fighter', () => {
    renderStage({ activePlayerTier: 'grunt' })
    loadAllImages()
    const gruntImages = screen.getAllByAltText('grunt')
    const attacking = gruntImages.filter(img => /grunt\/attack[12]\.png/.test(img.getAttribute('src') || ''))
    expect(attacking).toHaveLength(1)
  })

  it('replays the opponent attack when opponentAttackKey changes after completion', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now() + 16), 16) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    const attackImgs = () =>
      screen.getAllByAltText('grunt').filter(img => /grunt\/attack[12]\.png/.test(img.getAttribute('src') || ''))

    try {
      const { rerender } = renderStage({ activeOpponentTier: 'grunt', opponentAttackKey: 0 })
      loadAllImages()
      expect(attackImgs()).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(800)
      })
      expect(attackImgs()).toHaveLength(0)

      rerender(
        <BattleStage
          battleground={BATTLEGROUNDS.battleground1}
          playerTeam={TEAM_4}
          opponentTeam={TEAM_4}
          activePlayerTier={null}
          activeOpponentTier="grunt"
          cameraMode="wide"
          playerHP={1000}
          opponentHP={1000}
          opponentAttackKey={1}
        />,
      )
      loadAllImages()
      expect(attackImgs()).toHaveLength(1)
    } finally {
      cleanup()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it('plays hurt on ALL player fighters when player HP drops', () => {
    const { rerender } = renderStage()
    loadAllImages()
    rerender(
      <BattleStage
        battleground={BATTLEGROUNDS.battleground1}
        playerTeam={TEAM_4}
        opponentTeam={TEAM_4}
        activePlayerTier={null}
        activeOpponentTier={null}
        cameraMode="wide"
        playerHP={600}
        opponentHP={1000}
      />,
    )
    const hurtImages = screen.getAllByRole('img').filter(img => /\/hurt\.png/.test(img.getAttribute('src') || ''))
    expect(hurtImages).toHaveLength(4)
  })

  it('plays dead on ALL opponent fighters when opponent HP reaches 0', () => {
    const { rerender } = renderStage()
    loadAllImages()
    rerender(
      <BattleStage
        battleground={BATTLEGROUNDS.battleground1}
        playerTeam={TEAM_4}
        opponentTeam={TEAM_4}
        activePlayerTier={null}
        activeOpponentTier={null}
        cameraMode="wide"
        playerHP={1000}
        opponentHP={0}
      />,
    )
    const deadImages = screen.getAllByRole('img').filter(img => /\/dead\.png/.test(img.getAttribute('src') || ''))
    expect(deadImages).toHaveLength(4)
  })

  it('mounts a side directly in dead when HP is already 0', () => {
    renderStage({ playerHP: 0, opponentHP: 1000 })
    loadAllImages()
    const deadImages = screen.getAllByRole('img').filter(img => /\/dead\.png/.test(img.getAttribute('src') || ''))
    expect(deadImages).toHaveLength(4)
  })

  it('resolves a focus spot from the active tier', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, TEAM_4, 'grunt', 'playerFocused')).toEqual({ x: 0.12, y: 0.78 })
  })

  it('falls back to the center-most spot when the active tier is not in the team', () => {
    const spot = resolveFocusSpot(BATTLEGROUNDS.battleground1, TEAM_4, 'wizard', 'playerFocused')
    expect(spot).toEqual(BATTLEGROUNDS.battleground1.playerTeam[1])
  })

  it('has no focus in wide mode', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, TEAM_4, 'grunt', 'wide')).toBeNull()
  })
})
