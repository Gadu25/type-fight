'use client'

import { useEffect, useRef } from 'react'
import type { Battleground } from '@/lib/battlegrounds'
import { advanceParallaxOffset, layerTranslate } from './parallax'

interface ParallaxSceneProps {
  battleground: Battleground
  running: boolean
}

export default function ParallaxScene({ battleground, running }: ParallaxSceneProps) {
  const offsetRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const trackRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!running) {
      lastTimeRef.current = null
      return
    }

    let frameId: number
    const loop = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time
      }
      const elapsed = time - lastTimeRef.current
      lastTimeRef.current = time
      const viewportWidth = window.innerWidth
      offsetRef.current = advanceParallaxOffset(offsetRef.current, elapsed, viewportWidth)
      trackRefs.current.forEach((track, index) => {
        if (track) {
          const speed = battleground.layers[index]?.speed ?? 0
          track.style.transform = layerTranslate(speed, offsetRef.current)
        }
      })
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [running, battleground])

  const anchorClass = (anchor: 'top' | 'center' | 'bottom') =>
    anchor === 'top' ? 'object-top' : anchor === 'bottom' ? 'object-bottom' : 'object-center'

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {battleground.layers.map((layer, index) => (
        <div
          key={layer.id}
          ref={el => { trackRefs.current[index] = el }}
          className="absolute top-0 left-0 h-full w-[200%] flex will-change-transform"
          style={{ zIndex: index }}
        >
          {[0, 1].map(copy => (
            <img
              key={copy}
              src={layer.image}
              alt=""
              draggable={false}
              className={`w-1/2 h-full object-cover ${anchorClass(layer.anchor)}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
