import { describe, it, expect } from 'vitest'
import type { ClientMessage, ServerMessage } from './ws'

describe('ClientMessage types', () => {
  it('should have select_attack type', () => {
    const msg: ClientMessage = {
      type: 'select_attack',
      select_attack: { tier: 'quick' }
    }
    expect(msg.type).toBe('select_attack')
  })

  it('should have attack_complete type', () => {
    const msg: ClientMessage = {
      type: 'attack_complete',
      attack_complete: { correct: 50, total: 60 }
    }
    expect(msg.type).toBe('attack_complete')
  })

  it('should have switch_attack type', () => {
    const msg: ClientMessage = {
      type: 'switch_attack',
      switch_attack: { tier: 'heavy' }
    }
    expect(msg.type).toBe('switch_attack')
  })
})

describe('ServerMessage types', () => {
  it('should have attack_phrase type', () => {
    const msg: ServerMessage = {
      type: 'attack_phrase',
      attack_phrase: {
        phrase: 'The sword shines bright',
        tier: 'quick',
        damage: 80
      }
    }
    expect(msg.type).toBe('attack_phrase')
  })

  it('should have hp_update type', () => {
    const msg: ServerMessage = {
      type: 'hp_update',
      hp_update: {
        playerID: 'player1',
        hp: 920,
        attacker: 'player2',
        damage: 80
      }
    }
    expect(msg.type).toBe('hp_update')
  })

  it('should have player_defeated type', () => {
    const msg: ServerMessage = {
      type: 'player_defeated',
      player_defeated: { playerID: 'player1' }
    }
    expect(msg.type).toBe('player_defeated')
  })

  it('should have battle_over type', () => {
    const msg: ServerMessage = {
      type: 'battle_over',
      battle_over: { winner: 'player1', reason: 'opponent_defeated' }
    }
    expect(msg.type).toBe('battle_over')
  })
})
