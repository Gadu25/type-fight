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
      attack_complete: { tier: 'quick', phrase: 'test phrase', correct: 50, total: 60 }
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
  it('should have game_setup type', () => {
    const msg: ServerMessage = {
      type: 'game_setup',
      phrase_pools: { quick: ['phrase1'], normal: ['phrase2'] }
    }
    expect(msg.type).toBe('game_setup')
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

  it('should have game_start type with flat players', () => {
    const msg: ServerMessage = {
      type: 'game_start',
      players: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
      text: 'The quick brown fox'
    }
    expect(msg.type).toBe('game_start')
    expect(msg.players).toHaveLength(2)
  })

  it('should have player_ready type with ready_player_id', () => {
    const msg: ServerMessage = {
      type: 'player_ready',
      ready_player_id: 'player1'
    }
    expect(msg.type).toBe('player_ready')
  })

  it('should have play_again_request type with opponent_name', () => {
    const msg: ServerMessage = {
      type: 'play_again_request',
      opponent_name: 'Bob'
    }
    expect(msg.type).toBe('play_again_request')
  })

  it('should have game_over type with per-player results', () => {
    const msg: ServerMessage = {
      type: 'game_over',
      results: [
        { player_id: 'p1', name: 'Alice', wpm: 80, accuracy: 0.95, position: 1 },
        { player_id: 'p2', name: 'Bob', wpm: 60, accuracy: 0.80, position: 2 }
      ],
      winner: 'p1'
    }
    expect(msg.type).toBe('game_over')
    expect(msg.results).toHaveLength(2)
    expect(msg.winner).toBe('p1')
  })
})
