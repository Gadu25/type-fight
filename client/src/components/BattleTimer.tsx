'use client'

interface BattleTimerProps {
  timeLeft: number
}

export default function BattleTimer({ timeLeft }: BattleTimerProps) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`

  const getColorClass = () => {
    if (timeLeft <= 10) return 'text-red-500'
    if (timeLeft <= 30) return 'text-yellow-400'
    return 'text-white'
  }

  return (
    <div className={`text-xl font-mono font-bold px-2 ${getColorClass()}`}>
      {display}
    </div>
  )
}
