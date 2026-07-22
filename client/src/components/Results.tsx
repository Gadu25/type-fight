'use client';

import { ResultInfo } from '@/lib/ws';
import { useRouter } from 'next/navigation';

interface ResultsProps {
  results: ResultInfo[];
  winner: string | null;
  currentPlayerId: string | null;
}

export default function Results({
  results,
  winner,
  currentPlayerId,
}: ResultsProps) {
  const router = useRouter();
  
  const handlePlayAgain = () => {
    router.push('/');
  };
  
  const isWinner = winner === currentPlayerId || winner === '';
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {winner === '' ? "It's a Tie!" : isWinner ? 'You Win!' : 'You Lose!'}
      </h2>
      
      <div className="space-y-4">
        {results.map((result) => (
          <div
            key={result.player_id}
            className={`p-4 rounded-lg ${
              result.player_id === winner
                ? 'bg-green-900 border border-green-600'
                : 'bg-gray-700'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">
                {result.name}
                {result.player_id === currentPlayerId && ' (You)'}
              </span>
              {result.player_id === winner && (
                <span className="px-2 py-1 text-xs bg-yellow-600 rounded">Winner</span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">WPM</span>
                <p className="text-xl font-bold">{result.wpm.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-gray-400">Accuracy</span>
                <p className="text-xl font-bold">{result.accuracy.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <button
        onClick={handlePlayAgain}
        className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
