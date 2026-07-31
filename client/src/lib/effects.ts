import type { Sheet } from './characterSprites'

export type EffectKind = 'hit' | 'heal'

export const EFFECTS: Record<EffectKind, Sheet> = {
  hit: { src: '/effects/hit.png', duration: 400 },
  heal: { src: '/effects/heal.png', duration: 500 },
}
