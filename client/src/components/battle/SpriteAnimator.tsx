'use client'

import { useEffect, useRef, useState } from 'react'
import { getFrameIndex, type AnimMode } from '@/lib/spriteFrames'

interface SpriteAnimatorProps {
  src: string
  alt: string
  height?: number
  duration: number
  mode: AnimMode
  onComplete?: () => void
}

export default function SpriteAnimator({ src, alt, height = 128, duration, mode, onComplete }: SpriteAnimatorProps) {
  const [frameCount, setFrameCount] = useState(0)
  const [frameIndex, setFrameIndex] = useState(0)
  const onCompleteRef = useRef(onComplete)
  const firedRef = useRef(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    setFrameIndex(0)
    setFrameCount(0)
    firedRef.current = false
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) {
      const count = Math.floor(img.naturalWidth / 128)
      if (count > 0) setFrameCount(count)
    }
  }, [src])

  useEffect(() => {
    if (frameCount <= 0) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      if (mode === 'once' && elapsed >= duration) {
        setFrameIndex(frameCount - 1)
        if (!firedRef.current) {
          firedRef.current = true
          onCompleteRef.current?.()
        }
        return
      }
      if (mode === 'hold' && elapsed >= duration) {
        setFrameIndex(frameCount - 1)
        return
      }
      setFrameIndex(getFrameIndex(elapsed, frameCount, duration, mode))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [src, duration, mode, frameCount])

  return (
    <div style={{ width: height, height, overflow: 'hidden' }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={e => {
          const w = (e.currentTarget as HTMLImageElement).naturalWidth
          const count = Math.floor(w / 128)
          if (count > 0) setFrameCount(count)
        }}
        style={{
          width: frameCount > 0 ? frameCount * height : height,
          height,
          transform: `translateX(${-frameIndex * height}px)`,
          imageRendering: 'pixelated',
          opacity: frameCount > 0 ? 1 : 0,
        }}
      />
    </div>
  )
}
