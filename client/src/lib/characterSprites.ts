import type { Tier } from './words'

export interface Sheet {
  src: string
  duration: number
}

export interface CharacterAnimation {
  idle: Sheet
  attack1: Sheet
  attack2: Sheet
  hurt: Sheet
  dead: Sheet
}

const sheet = (tier: Tier, state: 'idle' | 'attack1' | 'attack2' | 'hurt' | 'dead'): Sheet => ({
  src: `/sprites/${tier}/${state}.png`,
  duration: state === 'idle' ? 2000 : state === 'attack1' || state === 'attack2' ? 700 : state === 'hurt' ? 400 : 900,
})

export const CHARACTER_ANIMATIONS: Record<Tier, CharacterAnimation> = {
  grunt: {
    idle: sheet('grunt', 'idle'),
    attack1: sheet('grunt', 'attack1'),
    attack2: sheet('grunt', 'attack2'),
    hurt: sheet('grunt', 'hurt'),
    dead: sheet('grunt', 'dead'),
  },
  archer: {
    idle: sheet('archer', 'idle'),
    attack1: sheet('archer', 'attack1'),
    attack2: sheet('archer', 'attack2'),
    hurt: sheet('archer', 'hurt'),
    dead: sheet('archer', 'dead'),
  },
  paladin: {
    idle: sheet('paladin', 'idle'),
    attack1: sheet('paladin', 'attack1'),
    attack2: sheet('paladin', 'attack2'),
    hurt: sheet('paladin', 'hurt'),
    dead: sheet('paladin', 'dead'),
  },
  wizard: {
    idle: sheet('wizard', 'idle'),
    attack1: sheet('wizard', 'attack1'),
    attack2: sheet('wizard', 'attack2'),
    hurt: sheet('wizard', 'hurt'),
    dead: sheet('wizard', 'dead'),
  },
  cleric: {
    idle: sheet('cleric', 'idle'),
    attack1: sheet('cleric', 'attack1'),
    attack2: sheet('cleric', 'attack2'),
    hurt: sheet('cleric', 'hurt'),
    dead: sheet('cleric', 'dead'),
  },
  priest: {
    idle: sheet('priest', 'idle'),
    attack1: sheet('priest', 'attack1'),
    attack2: sheet('priest', 'attack2'),
    hurt: sheet('priest', 'hurt'),
    dead: sheet('priest', 'dead'),
  },
  saint: {
    idle: sheet('saint', 'idle'),
    attack1: sheet('saint', 'attack1'),
    attack2: sheet('saint', 'attack2'),
    hurt: sheet('saint', 'hurt'),
    dead: sheet('saint', 'dead'),
  },
}

export function getRandomAttackAnim(tier: Tier): Sheet {
  return Math.random() < 0.5 ? CHARACTER_ANIMATIONS[tier].attack1 : CHARACTER_ANIMATIONS[tier].attack2
}

export function getMaxHurtDuration(team: Tier[]): number {
  if (team.length === 0) return 400
  return Math.max(...team.map(t => CHARACTER_ANIMATIONS[t].hurt.duration))
}
