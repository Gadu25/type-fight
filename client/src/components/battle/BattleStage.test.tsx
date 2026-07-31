import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleStage, { resolveFocusSpot } from './BattleStage'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'
import { DEFAULT_TEAM } from '@/lib/team'

describe('BattleStage', () => {
  it('renders both 4-member teams over the scene', () => {
    render(
      <BattleStage
        battleground={BATTLEGROUNDS.battleground1}
        running={false}
        playerTeam={DEFAULT_TEAM}
        opponentTeam={DEFAULT_TEAM}
        activePlayerTier={null}
        activeOpponentTier={null}
        cameraMode="wide"
      />
    )
    expect(screen.getAllByAltText(/grunt|archer|paladin|cleric/)).toHaveLength(8)
  })

  it('resolves a focus spot from the active tier', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, DEFAULT_TEAM, 'grunt', 'playerFocused')).toEqual({ x: 0.12, y: 0.78 })
  })

  it('falls back to the center-most spot when the active tier is not in the team', () => {
    const spot = resolveFocusSpot(BATTLEGROUNDS.battleground1, DEFAULT_TEAM, 'wizard', 'playerFocused')
    expect(spot).toEqual(BATTLEGROUNDS.battleground1.playerTeam[1])
  })

  it('has no focus in wide mode', () => {
    expect(resolveFocusSpot(BATTLEGROUNDS.battleground1, DEFAULT_TEAM, 'grunt', 'wide')).toBeNull()
  })
})
