'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Battleground, FighterSpot } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { CHARACTER_ANIMATIONS, getMaxHurtDuration, getRandomAttackAnim, type Sheet } from '@/lib/characterSprites'
import ParallaxScene from './ParallaxScene'
import BattleCamera from './BattleCamera'
import SpriteAnimator from './SpriteAnimator'

export type CameraMode = 'wide' | 'playerFocused'

interface BattleStageProps {
  battleground: Battleground
  playerTeam: Team
  opponentTeam: Team
  activePlayerTier: Tier | null
  activeOpponentTier: Tier | null
  cameraMode: CameraMode
  playerHP: number
  opponentHP: number
  playerAttackKey: number
  opponentAttackKey: number
}

type AnimKind = 'idle' | 'attack' | 'hurt' | 'dead'

interface FighterResolved {
  sheet: Sheet
  kind: AnimKind
  key: string
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

function resolveFighter(
  tier: Tier,
  team: Team,
  activeTier: Tier | null,
  attackSheet: Sheet | null,
  attackKey: number,
  sideDead: boolean,
  sideHurt: boolean,
  hurtKey: number,
  attackDone: boolean,
): FighterResolved | null {
  if (!team.includes(tier)) return null
  const def = CHARACTER_ANIMATIONS[tier]
  if (sideDead) return { sheet: def.dead, kind: 'dead', key: `dead` }
  if (sideHurt) return { sheet: def.hurt, kind: 'hurt', key: `hurt-${hurtKey}` }
  if (tier === activeTier && attackSheet && !attackDone) {
    return { sheet: attackSheet, kind: 'attack', key: `attack-${attackKey}` }
  }
  return { sheet: def.idle, kind: 'idle', key: `idle` }
}

function Fighter({
  tier,
  team,
  spot,
  activeTier,
  attackSheet,
  attackKey,
  sideDead,
  sideHurt,
  hurtKey,
  mirror,
  prefix,
}: {
  tier: Tier
  team: Team
  spot: FighterSpot
  activeTier: Tier | null
  attackSheet: Sheet | null
  attackKey: number
  sideDead: boolean
  sideHurt: boolean
  hurtKey: number
  mirror: boolean
  prefix: string
}) {
  const [attackDone, setAttackDone] = useState(true)
  const prevAttackKeyRef = useRef(attackKey)
  const isActive = tier === activeTier

  useEffect(() => {
    if (attackKey !== prevAttackKeyRef.current) {
      prevAttackKeyRef.current = attackKey
      if (isActive) setAttackDone(false)
    }
  }, [attackKey, isActive])

  const resolved = resolveFighter(tier, team, activeTier, attackSheet, attackKey, sideDead, sideHurt, hurtKey, attackDone)
  if (!resolved) return null

  const mode = resolved.kind === 'dead' ? 'hold' : resolved.kind === 'idle' ? 'loop' : 'once'
  const onComplete = resolved.kind === 'attack' ? () => setAttackDone(true) : undefined

  return (
    <div
      className="absolute"
      style={{
        left: `${spot.x * 100}%`,
        top: `${spot.y * 100}%`,
        transform: `translate(-50%, -100%) ${mirror ? 'scaleX(-1)' : ''}`,
        zIndex: 10,
      }}
    >
      <SpriteAnimator
        key={`${prefix}-${tier}-${resolved.key}`}
        src={resolved.sheet.src}
        alt={tier}
        height={Math.round(128 * (spot.scale ?? 1))}
        duration={resolved.sheet.duration}
        mode={mode}
        onComplete={onComplete}
      />
    </div>
  )
}

export default function BattleStage({
  battleground,
  playerTeam,
  opponentTeam,
  activePlayerTier,
  activeOpponentTier,
  cameraMode,
  playerHP,
  opponentHP,
  playerAttackKey,
  opponentAttackKey,
}: BattleStageProps) {
  const focus = resolveFocusSpot(battleground, playerTeam, activePlayerTier, cameraMode)

  const playerAttackSheet = useMemo(
    () => (activePlayerTier ? getRandomAttackAnim(activePlayerTier) : null),
    [activePlayerTier],
  )
  const opponentAttackSheet = useMemo(
    () => (activeOpponentTier ? getRandomAttackAnim(activeOpponentTier) : null),
    [activeOpponentTier],
  )

  const playerDead = playerHP <= 0
  const opponentDead = opponentHP <= 0

  const prevPlayerHPRef = useRef(playerHP)
  const prevOpponentHPRef = useRef(opponentHP)
  const [playerHurtKey, setPlayerHurtKey] = useState(0)
  const [opponentHurtKey, setOpponentHurtKey] = useState(0)
  const [playerHurtActive, setPlayerHurtActive] = useState(false)
  const [opponentHurtActive, setOpponentHurtActive] = useState(false)

  useEffect(() => {
    const prev = prevPlayerHPRef.current
    prevPlayerHPRef.current = playerHP
    if (playerHP < prev) {
      setPlayerHurtActive(true)
      setPlayerHurtKey(k => k + 1)
      const t = setTimeout(() => setPlayerHurtActive(false), getMaxHurtDuration(playerTeam))
      return () => clearTimeout(t)
    }
  }, [playerHP, playerTeam])

  useEffect(() => {
    const prev = prevOpponentHPRef.current
    prevOpponentHPRef.current = opponentHP
    if (opponentHP < prev) {
      setOpponentHurtActive(true)
      setOpponentHurtKey(k => k + 1)
      const t = setTimeout(() => setOpponentHurtActive(false), getMaxHurtDuration(opponentTeam))
      return () => clearTimeout(t)
    }
  }, [opponentHP, opponentTeam])

  const renderTeam = (
    team: Team,
    spots: FighterSpot[],
    activeTier: Tier | null,
    attackSheet: Sheet | null,
    attackKey: number,
    sideDead: boolean,
    sideHurt: boolean,
    hurtKey: number,
    mirror: boolean,
    prefix: string,
  ) =>
    team.map((tier, index) => (
      <Fighter
        key={`${prefix}-${tier}`}
        tier={tier}
        team={team}
        spot={spots[index]}
        activeTier={activeTier}
        attackSheet={attackSheet}
        attackKey={attackKey}
        sideDead={sideDead}
        sideHurt={sideHurt}
        hurtKey={hurtKey}
        mirror={mirror}
        prefix={prefix}
      />
    ))

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <BattleCamera focus={focus}>
        <ParallaxScene battleground={battleground} />
        <div className="absolute inset-0">
          {renderTeam(playerTeam, battleground.playerTeam, activePlayerTier, playerAttackSheet, playerAttackKey, playerDead, playerHurtActive, playerHurtKey, false, 'player')}
          {renderTeam(opponentTeam, battleground.opponentTeam, activeOpponentTier, opponentAttackSheet, opponentAttackKey, opponentDead, opponentHurtActive, opponentHurtKey, true, 'opponent')}
        </div>
      </BattleCamera>
    </div>
  )
}
