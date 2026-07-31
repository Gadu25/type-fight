import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BattleStage, { resolveFocusSpot } from './BattleStage'
import { BATTLEGROUNDS } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'

const TEAM_4: Team = ['grunt', 'archer', 'paladin', 'cleric']

describe('BattleStage', () => {
  it('renders both 4-member teams over the scene', () => {
    render(
      <BattleStage
        battleground={BATTLEGROUNDS.battleground1}
        running={false}
        playerTeam={TEAM_4}
        opponentTeam={TEAM_4}
        activePlayerTier={null}
        activeOpponentTier={null}
        cameraMode="wide"
      />
    )
    expect(screen.getAllByAltText(/grunt|archer|paladin|cleric/)).toHaveLength(8)
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
