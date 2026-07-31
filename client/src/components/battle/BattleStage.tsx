'use client'

import type { Battleground, FighterSpot } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { SPRITE_MAP } from '@/lib/sprites'
import ParallaxScene from './ParallaxScene'
import BattleCamera from './BattleCamera'
import FighterSprite from './FighterSprite'

export type CameraMode = 'wide' | 'playerFocused'

interface BattleStageProps {
  battleground: Battleground
  running: boolean
  playerTeam: Team
  opponentTeam: Team
  activePlayerTier: Tier | null
  activeOpponentTier: Tier | null
  cameraMode: CameraMode
}

export function resolveFocusSpot(
  battleground: Battleground,
  playerTeam: Team,
  activePlayerTier: Tier | null,
  cameraMode: CameraMode,
): FighterSpot | null {
  if (cameraMode !== 'playerFocused' || !activePlayerTier) return null
  const index = playerTeam.indexOf(activePlayerTier)
  if (index >= 0) return battleground.playerTeam[index]
  return battleground.playerTeam[1]
}

export default function BattleStage({
  battleground,
  running,
  playerTeam,
  opponentTeam,
  activePlayerTier,
  activeOpponentTier,
  cameraMode,
}: BattleStageProps) {
  const focus = resolveFocusSpot(battleground, playerTeam, activePlayerTier, cameraMode)

  const renderTeam = (team: Team, spots: FighterSpot[], activeTier: Tier | null, mirror: boolean, prefix: string) =>
    team.map((tier, index) => {
      const spot = spots[index]
      return (
        <div
          key={`${prefix}-${tier}`}
          className="absolute"
          style={{
            left: `${spot.x * 100}%`,
            top: `${spot.y * 100}%`,
            transform: `translate(-50%, -100%) ${mirror ? 'scaleX(-1)' : ''}`,
            zIndex: 10,
          }}
        >
          <FighterSprite src={SPRITE_MAP[tier]} alt={tier} active={tier === activeTier} />
        </div>
      )
    })

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <BattleCamera focus={focus}>
        <ParallaxScene battleground={battleground} running={running} />
        <div className="absolute inset-0">
          {renderTeam(playerTeam, battleground.playerTeam, activePlayerTier, false, 'player')}
          {renderTeam(opponentTeam, battleground.opponentTeam, activeOpponentTier, true, 'opponent')}
        </div>
      </BattleCamera>
    </div>
  )
}
