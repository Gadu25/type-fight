import { describe, it, expect } from 'vitest'
import { BATTLEGROUNDS, getBattleground, validateBattleground } from './battlegrounds'

describe('battlegrounds manifest', () => {
  it('has a valid battleground1 entry', () => {
    const bg = BATTLEGROUNDS.battleground1
    expect(bg).toBeDefined()
    expect(validateBattleground(bg)).toEqual([])
  })

  it('looks up an id and falls back to battleground1 for unknown/missing ids', () => {
    expect(getBattleground('battleground1').id).toBe('battleground1')
    expect(getBattleground('nope').id).toBe('battleground1')
    expect(getBattleground(undefined).id).toBe('battleground1')
  })

  it('rejects an out-of-range layer speed', () => {
    const bg = {
      ...BATTLEGROUNDS.battleground1,
      layers: [{ ...BATTLEGROUNDS.battleground1.layers[0], speed: 2 }],
    }
    expect(validateBattleground(bg).length).toBeGreaterThan(0)
  })

  it('rejects a team without exactly 4 spots', () => {
    const bg = { ...BATTLEGROUNDS.battleground1, playerTeam: [] }
    expect(validateBattleground(bg).length).toBeGreaterThan(0)
  })
})
