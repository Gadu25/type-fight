'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TypingAreaProps {
  phrase: string
  onComplete: (result: { correct: number; total: number }) => void
  disabled?: boolean
}

export default function TypingArea({ phrase, onComplete, disabled }: TypingAreaProps) {
  const [position, setPosition] = useState(0)
  const [errors, setErrors] = useState<Set<number>>(new Set())
  const [correctCount, setCorrectCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const positionRef = useRef(0)
  const errorsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    setPosition(0)
    setErrors(new Set())
    setCorrectCount(0)
    positionRef.current = 0
    errorsRef.current = new Set()
  }, [phrase])

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return
    const pos = positionRef.current
    const errs = errorsRef.current

    if (e.key === 'Backspace') {
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
          setCorrectCount(prev => prev - 1)
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
    if (e.key === phrase[pos]) {
      const newPos = pos + 1
      positionRef.current = newPos
      setPosition(prev => prev + 1)
      setCorrectCount(prev => prev + 1)
      if (newPos === phrase.length) {
        onComplete({ correct: positionRef.current, total: phrase.length })
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
    <div className="p-4 bg-gray-900 rounded-lg">
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
