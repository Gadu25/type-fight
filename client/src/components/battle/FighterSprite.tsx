'use client'

interface FighterSpriteProps {
  src: string
  alt: string
  active: boolean
  size?: number
}

export default function FighterSprite({ src, alt, active, size = 160 }: FighterSpriteProps) {
  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        animation: 'fighter-bob 2s ease-in-out infinite',
      }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        className="w-full h-full object-contain select-none"
        style={
          active
            ? { outline: '3px solid #fbbf24', borderRadius: 12, filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.8))' }
            : undefined
        }
      />
    </div>
  )
}
