'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { FighterSpot } from '@/lib/battlegrounds'

const ZOOM_SCALE = 1.12

interface BattleCameraProps {
  focus: FighterSpot | null
  children: ReactNode
}

export default function BattleCamera({ focus, children }: BattleCameraProps) {
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    transform: focus ? `scale(${ZOOM_SCALE})` : 'scale(1)',
    transformOrigin: focus ? `${focus.x * 100}% ${focus.y * 100}%` : '50% 50%',
    transition: 'transform 500ms cubic-bezier(.22,.9,.35,1)',
    willChange: 'transform',
  }
  return <div style={style}>{children}</div>
}
