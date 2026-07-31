'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Battleground, FighterSpot } from '@/lib/battlegrounds'
import type { Team } from '@/lib/team'
import type { Tier } from '@/lib/words'
import { CHARACTER_ANIMATIONS, getRandomAttackAnim, type Sheet } from '@/lib/characterSprites'
import { EFFECTS, type EffectKind } from '@/lib/effects'
import ParallaxScene from './ParallaxScene'
import BattleCamera from './BattleCamera'
import SpriteAnimator from './SpriteAnimator'

export type CameraMode = 'wide' | 'playerFocused'

const HURT_HOLD_MS = 2000

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
  playerHealKey: number
  opponentHealKey: number
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
  playerHealKey,
  opponentHealKey,
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
  const [playerEffect, setPlayerEffect] = useState<{ kind: EffectKind; key: number } | null>(null)
  const [opponentEffect, setOpponentEffect] = useState<{ kind: EffectKind; key: number } | null>(null)
  const prevPlayerHealKeyRef = useRef(playerHealKey)
  const prevOpponentHealKeyRef = useRef(opponentHealKey)
  const playerHurtKeyRef = useRef(0)
  const opponentHurtKeyRef = useRef(0)

  useEffect(() => {
    const prev = prevPlayerHPRef.current
    prevPlayerHPRef.current = playerHP
    if (playerHP < prev) {
      playerHurtKeyRef.current += 1
      setPlayerHurtKey(playerHurtKeyRef.current)
      setPlayerEffect({ kind: 'hit', key: playerHurtKeyRef.current })
    }
  }, [playerHP])

  useEffect(() => {
    if (playerHurtKey === 0) return
    setPlayerHurtActive(true)
    const t = setTimeout(() => setPlayerHurtActive(false), HURT_HOLD_MS)
    return () => clearTimeout(t)
  }, [playerHurtKey])

  useEffect(() => {
    const prev = prevOpponentHPRef.current
    prevOpponentHPRef.current = opponentHP
    if (opponentHP < prev) {
      opponentHurtKeyRef.current += 1
      setOpponentHurtKey(opponentHurtKeyRef.current)
      setOpponentEffect({ kind: 'hit', key: opponentHurtKeyRef.current })
    }
  }, [opponentHP])

  useEffect(() => {
    if (opponentHurtKey === 0) return
    setOpponentHurtActive(true)
    const t = setTimeout(() => setOpponentHurtActive(false), HURT_HOLD_MS)
    return () => clearTimeout(t)
  }, [opponentHurtKey])

  useEffect(() => {
    if (playerHealKey !== prevPlayerHealKeyRef.current) {
      prevPlayerHealKeyRef.current = playerHealKey
      setPlayerEffect({ kind: 'heal', key: playerHealKey })
    }
  }, [playerHealKey])

  useEffect(() => {
    if (opponentHealKey !== prevOpponentHealKeyRef.current) {
      prevOpponentHealKeyRef.current = opponentHealKey
      setOpponentEffect({ kind: 'heal', key: opponentHealKey })
    }
  }, [opponentHealKey])

  const renderEffect = (
    spots: FighterSpot[],
    effect: { kind: EffectKind; key: number } | null,
    mirror: boolean,
    prefix: string,
  ) => {
    if (!effect) return null
    const sheet = EFFECTS[effect.kind]
    return spots.map((spot, index) => (
      <div
        key={`${prefix}-effect-${effect.kind}-${effect.key}-${index}`}
        className="absolute"
        style={{
          left: `${spot.x * 100}%`,
          top: `${spot.y * 100}%`,
          transform: `translate(-50%, -100%) ${mirror ? 'scaleX(-1)' : ''}`,
          zIndex: 20,
        }}
      >
        <SpriteAnimator
          src={sheet.src}
          alt={`${prefix}-${effect.kind}`}
          height={Math.round(128 * (spot.scale ?? 1))}
          duration={sheet.duration}
          mode="once"
          onComplete={() => {
            if (prefix === 'player') setPlayerEffect(null)
            else setOpponentEffect(null)
          }}
        />
      </div>
    ))
  }

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
          {renderEffect(battleground.playerTeam, playerEffect, false, 'player')}
          {renderEffect(battleground.opponentTeam, opponentEffect, true, 'opponent')}
        </div>
      </BattleCamera>
    </div>
  )
}
