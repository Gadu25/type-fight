export type LayerAnchor = 'top' | 'center' | 'bottom'

export interface ParallaxLayer {
  id: string
  image: string
  speed: number
  anchor: LayerAnchor
}

export interface FighterSpot {
  x: number
  y: number
}

export interface Battleground {
  id: string
  name: string
  layers: ParallaxLayer[]
  playerTeam: FighterSpot[]
  opponentTeam: FighterSpot[]
}

export const BATTLEGROUNDS: Record<string, Battleground> = {
  battleground1: {
    id: 'battleground1',
    name: 'Ancient Ruins',
    layers: [
      { id: 'sky', image: '/battlegrounds/battleground1/sky.png', speed: 0.0, anchor: 'top' },
      { id: 'ruins-bg', image: '/battlegrounds/battleground1/ruins-bg.png', speed: 0.08, anchor: 'bottom' },
      { id: 'ruins2', image: '/battlegrounds/battleground1/ruins2.png', speed: 0.18, anchor: 'bottom' },
      { id: 'ruins', image: '/battlegrounds/battleground1/ruins.png', speed: 0.32, anchor: 'bottom' },
      { id: 'hill-trees', image: '/battlegrounds/battleground1/hill-trees.png', speed: 0.5, anchor: 'bottom' },
      { id: 'statue', image: '/battlegrounds/battleground1/statue.png', speed: 0.72, anchor: 'bottom' },
      { id: 'stones-grass', image: '/battlegrounds/battleground1/stones-grass.png', speed: 1.0, anchor: 'bottom' },
    ],
    playerTeam: [
      { x: 0.12, y: 0.78 },
      { x: 0.2, y: 0.78 },
      { x: 0.28, y: 0.78 },
      { x: 0.36, y: 0.78 },
    ],
    opponentTeam: [
      { x: 0.64, y: 0.78 },
      { x: 0.72, y: 0.78 },
      { x: 0.8, y: 0.78 },
      { x: 0.88, y: 0.78 },
    ],
  },
}

export function getBattleground(id: string | undefined): Battleground {
  return (id && BATTLEGROUNDS[id]) || BATTLEGROUNDS.battleground1
}

export function validateBattleground(battleground: Battleground): string[] {
  const errors: string[] = []
  if (battleground.layers.length === 0) errors.push('must have at least one layer')
  for (const layer of battleground.layers) {
    if (layer.speed < 0 || layer.speed > 1) errors.push(`layer "${layer.id}" speed must be 0-1`)
    if (!layer.image.startsWith('/battlegrounds/')) errors.push(`layer "${layer.id}" image must be under /battlegrounds/`)
    if (layer.anchor !== 'top' && layer.anchor !== 'center' && layer.anchor !== 'bottom') {
      errors.push(`layer "${layer.id}" has an invalid anchor`)
    }
  }
  if (battleground.playerTeam.length !== 4) errors.push('playerTeam must have exactly 4 spots')
  if (battleground.opponentTeam.length !== 4) errors.push('opponentTeam must have exactly 4 spots')
  return errors
}
