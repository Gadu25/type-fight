'use client'

import type { Battleground } from '@/lib/battlegrounds'

interface ParallaxSceneProps {
  battleground: Battleground
}

export default function ParallaxScene({ battleground }: ParallaxSceneProps) {
  const anchorClass = (anchor: 'top' | 'center' | 'bottom') =>
    anchor === 'top' ? 'object-top' : anchor === 'bottom' ? 'object-bottom' : 'object-center'

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {battleground.layers.map((layer, index) => (
        <img
          key={layer.id}
          src={layer.image}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover ${anchorClass(layer.anchor)}`}
          style={{ zIndex: index }}
        />
      ))}
    </div>
  )
}
