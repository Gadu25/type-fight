'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TypingAreaProps {
  phrase: string
  onComplete: (result: { correct: number; total: number }) => void
  onStartTyping?: () => void
  disabled?: boolean
  damageFlash?: number
}

function generateShakeKeyframe(damage: number): string {
  const cycles = Math.round(3 + (damage / 600) * 7)
  const maxOffset = 4 + (damage / 600) * 6
  const maxBlur = 1 + (damage / 600) * 3
  const steps: string[] = ['0% { transform: translateX(0); filter: blur(0); }']
  for (let i = 0; i < cycles; i++) {
    const progress = (i + 1) / (cycles + 1)
    const decay = 1 - progress
    const left = Math.round(progress * 100 * 0.5)
    const right = Math.round((1 - progress) * 100 * 0.5 + progress * 50)
    const offset = Math.round(maxOffset * decay * 10) / 10
    const blur = Math.round(maxBlur * decay * 10) / 10
    steps.push(`${left}% { transform: translateX(-${offset}px); filter: blur(${blur}px); }`)
    steps.push(`${right}% { transform: translateX(${offset}px); filter: blur(${blur}px); }`)
  }
  steps.push('100% { transform: translateX(0); filter: blur(0); }')
  return steps.join('\n')
}

export default function TypingArea({ phrase, onComplete, onStartTyping, disabled, damageFlash = 0 }: TypingAreaProps) {
  const [position, setPosition] = useState(0)
  const [errors, setErrors] = useState<Set<number>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const positionRef = useRef(0)
  const errorsRef = useRef<Set<number>>(new Set())
  const correctCountRef = useRef(0)
  const totalKeystrokesRef = useRef(0)
  const damageKeyRef = useRef(0)
  const wiggleKeyRef = useRef(0)
  const startedRef = useRef(false)
  const [damageKey, setDamageKey] = useState(0)
  const [animName, setAnimName] = useState('')
  const [wiggle, setWiggle] = useState<{ index: number; key: number } | null>(null)

  useEffect(() => {
    const css = `@keyframes char-wiggle {
      0%   { transform: translateX(0) rotate(0deg); }
      20%  { transform: translateX(-3px) rotate(-6deg); }
      40%  { transform: translateX(3px) rotate(6deg); }
      60%  { transform: translateX(-2px) rotate(-4deg); }
      80%  { transform: translateX(2px) rotate(4deg); }
      100% { transform: translateX(0) rotate(0deg); }
    }`
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  useEffect(() => {
    setPosition(0)
    setErrors(new Set())
    positionRef.current = 0
    errorsRef.current = new Set()
    correctCountRef.current = 0
    totalKeystrokesRef.current = 0
    startedRef.current = false
  }, [phrase])

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  useEffect(() => {
    if (damageFlash > 0) {
      const name = `damage-shake-${damageKeyRef.current + 1}`
      damageKeyRef.current += 1
      setDamageKey(damageKeyRef.current)
      setAnimName(name)

      const css = `@keyframes ${name} { ${generateShakeKeyframe(damageFlash)} }`
      const style = document.createElement('style')
      style.textContent = css
      document.head.appendChild(style)
      return () => { document.head.removeChild(style) }
    }
  }, [damageFlash])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return
    const pos = positionRef.current
    const errs = errorsRef.current

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (errs.has(pos)) {
        return
      } else if (pos > 0) {
        const newPos = pos - 1
        positionRef.current = newPos
        setPosition(newPos)
        correctCountRef.current -= 1
      }
      return
    }
    if (e.key.length !== 1) return
    if (pos >= phrase.length) return
    if (!startedRef.current) {
      startedRef.current = true
      onStartTyping?.()
    }
    e.preventDefault()
    if (e.key === phrase[pos]) {
      const newPos = pos + 1
      positionRef.current = newPos
      setPosition(prev => prev + 1)
      correctCountRef.current += 1
      totalKeystrokesRef.current += 1
      if (newPos === phrase.length) {
        onComplete({ correct: correctCountRef.current, total: totalKeystrokesRef.current })
      }
    } else {
      const next = new Set(errs).add(pos)
      errorsRef.current = next
      setErrors(next)
      totalKeystrokesRef.current += 1

      wiggleKeyRef.current += 1
      setWiggle({ index: pos, key: wiggleKeyRef.current })
    }
  }, [phrase, disabled, onComplete, onStartTyping])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderText = () => {
    return phrase.split('').map((char, index) => {
      let className = 'text-gray-500'
      if (index < position) {
        if (errors.has(index)) {
          className = 'text-red-500'
        } else {
          className = 'text-green-400'
        }
      } else if (index === position) {
        if (errors.has(index)) {
          className = 'text-red-500 bg-gray-700'
        } else if (position > 0) {
          className = 'text-white bg-gray-700'
        }
      }

      const isWiggling = wiggle?.index === index
      return (
        <span
          key={isWiggling ? `${index}-${wiggle.key}` : index}
          role="span"
          className={className}
          style={
            isWiggling
              ? { display: 'inline-block', whiteSpace: 'pre', animation: 'char-wiggle 0.25s ease-in-out' }
              : undefined
          }
        >
          {char}
        </span>
      )
    })
  }

  return (
    <div
      key={damageKey}
      className="p-4 bg-gray-900 rounded-lg"
      style={damageFlash > 0 ? {
        animation: `${animName} ${0.3 + (damageFlash / 600) * 0.9}s ease-out`,
      } : undefined}
    >
      <input
        ref={inputRef}
        type="text"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
      />
      <div className="font-mono text-lg leading-relaxed">
        {renderText()}
      </div>
    </div>
  )
}
