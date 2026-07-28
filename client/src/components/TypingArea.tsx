'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TypingAreaProps {
  phrase: string
  onComplete: (result: { correct: number; total: number }) => void
  disabled?: boolean
  damageFlash?: number
}

export default function TypingArea({ phrase, onComplete, disabled, damageFlash = 0 }: TypingAreaProps) {
  const [position, setPosition] = useState(0)
  const [errors, setErrors] = useState<Set<number>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const positionRef = useRef(0)
  const errorsRef = useRef<Set<number>>(new Set())
  const correctCountRef = useRef(0)
  const damageKeyRef = useRef(0)
  const [damageKey, setDamageKey] = useState(0)

  useEffect(() => {
    setPosition(0)
    setErrors(new Set())
    positionRef.current = 0
    errorsRef.current = new Set()
    correctCountRef.current = 0
  }, [phrase])

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  useEffect(() => {
    if (damageFlash > 0) {
      damageKeyRef.current += 1
      setDamageKey(damageKeyRef.current)
    }
  }, [damageFlash])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return
    const pos = positionRef.current
    const errs = errorsRef.current

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (errs.has(pos)) {
        const next = new Set(errs)
        next.delete(pos)
        errorsRef.current = next
        setErrors(next)
      } else if (pos > 0) {
        const newPos = pos - 1
        positionRef.current = newPos
        setPosition(newPos)
        if (!errs.has(newPos)) {
          correctCountRef.current -= 1
        } else {
          const next = new Set(errs)
          next.delete(newPos)
          errorsRef.current = next
          setErrors(next)
        }
      }
      return
    }
    if (e.key.length !== 1) return
    if (pos >= phrase.length) return
    e.preventDefault()
    if (e.key === phrase[pos]) {
      const newPos = pos + 1
      positionRef.current = newPos
      setPosition(prev => prev + 1)
      correctCountRef.current += 1
      if (newPos === phrase.length) {
        onComplete({ correct: correctCountRef.current, total: phrase.length })
      }
    } else {
      const next = new Set(errs).add(pos)
      errorsRef.current = next
      setErrors(next)
    }
  }, [phrase, disabled, onComplete])

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
          className = 'text-red-500'
        } else if (position > 0) {
          className = 'text-white bg-gray-700'
        }
      }
      return (
        <span key={index} role="span" className={className}>
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
        animation: `damage-shake ${0.3 + (damageFlash / 600) * 0.4}s ease-out`,
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
