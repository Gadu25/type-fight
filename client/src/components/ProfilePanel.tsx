'use client';

import { useEffect, useState } from 'react';
import { getAccount, PlayerAccount, MatchRecord } from '@/lib/account';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function computeStats(account: PlayerAccount) {
  const total = account.matchHistory.length;
  if (total === 0) {
    return { winrate: 0, avgWpm: 0, totalGames: 0 };
  }
  const wins = account.matchHistory.filter((m) => m.winner).length;
  const avgWpm =
    account.matchHistory.reduce((sum, m) => sum + m.wpm, 0) / total;
  return {
    winrate: (wins / total) * 100,
    avgWpm,
    totalGames: total,
  };
}

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const [account, setAccount] = useState<PlayerAccount | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccount(getAccount());
    }
  }, [isOpen]);

  const stats = account && account.matchHistory.length > 0 ? computeStats(account) : null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-gray-800 border-l border-gray-700 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold">Profile</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-700 transition-colors"
              aria-label="Close profile"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {!account ? (
              <p className="text-gray-400 text-center mt-8">
                Play a game to see your stats.
              </p>
            ) : (
              <>
                {/* Name */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold">{account.name}</h3>
                </div>

                {/* Stats */}
                {stats && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <span className="text-xs text-gray-400 block">Winrate</span>
                      <span className="text-xl font-bold">
                        {stats.winrate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-400 block">Avg WPM</span>
                      <span className="text-xl font-bold">
                        {stats.avgWpm.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-400 block">Games</span>
                      <span className="text-xl font-bold">
                        {stats.totalGames}
                      </span>
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-700 mb-4" />

                {/* Match History */}
                <h4 className="text-sm font-semibold text-gray-400 mb-3">
                  Match History
                </h4>
                {account.matchHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No games yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...account.matchHistory]
                      .reverse()
                      .map((match: MatchRecord, i: number) => (
                        <div
                          key={i}
                          className="p-3 bg-gray-700 rounded-md"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">
                              vs {match.opponentName}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                match.winner ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>{match.wpm.toFixed(1)} WPM</span>
                            <span>{(match.accuracy * 100).toFixed(1)}%</span>
                            <span>{formatDate(match.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
