'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  onComplete: () => void;
}

type CountdownPhase = '3' | '2' | '1' | 'Go!';

const PHASES: CountdownPhase[] = ['3', '2', '1', 'Go!'];
const PHASE_DURATION = 1000;
const GO_DISPLAY_DURATION = 600;

export default function Countdown({ onComplete }: CountdownProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const phase = PHASES[phaseIndex];
    const duration = phase === 'Go!' ? GO_DISPLAY_DURATION : PHASE_DURATION;

    const timer = setTimeout(() => {
      if (phaseIndex < PHASES.length - 1) {
        setPhaseIndex(phaseIndex + 1);
      } else {
        onComplete();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [phaseIndex, onComplete]);

  const isGo = PHASES[phaseIndex] === 'Go!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        key={phaseIndex}
        className={`text-8xl md:text-9xl font-black select-none countdown-pop ${
          isGo ? 'text-emerald-400' : 'text-white'
        }`}
      >
        {PHASES[phaseIndex]}
      </div>
    </div>
  );
}
