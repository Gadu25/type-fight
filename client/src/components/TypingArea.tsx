'use client';

import { useEffect, useRef, useState } from 'react';

interface TypingAreaProps {
  text: string;
  onKeystroke: (char: string, position: number) => void;
  isActive: boolean;
  currentPosition: number;
}

export default function TypingArea({
  text,
  onKeystroke,
  isActive,
  currentPosition,
}: TypingAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isActive) return;

    if (e.key === 'Backspace') {
      return;
    }

    if (e.key.length === 1) {
      const expectedChar = text[currentPosition];
      if (e.key === expectedChar) {
        onKeystroke(e.key, currentPosition + 1);
      }
    }
  };

  const renderText = () => {
    return text.split('').map((char, index) => {
      let className = 'text-gray-500';

      if (index < currentPosition) {
        className = 'text-green-400';
      } else if (index === currentPosition) {
        className = 'text-white bg-gray-700';
      }

      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-lg font-mono leading-relaxed mb-4 whitespace-pre-wrap">
        {renderText()}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!isActive}
        className="w-full px-4 py-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        placeholder={isActive ? 'Start typing...' : 'Waiting for game to start...'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
    </div>
  );
}
