'use client'

interface HealthBarProps {
  name: string
  hp: number
  maxHp: number
}

export default function HealthBar({ name, hp, maxHp }: HealthBarProps) {
  const percentage = Math.max(0, Math.min(100, (hp / maxHp) * 100))

  const getBarColor = () => {
    if (percentage > 60) return 'bg-green-500'
    if (percentage > 30) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-white">{name}</span>
        <span className="text-sm text-gray-400">{hp} / {maxHp}</span>
      </div>
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          role="progressbar"
          className={`h-full ${getBarColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}