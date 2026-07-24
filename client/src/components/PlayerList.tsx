'use client';

import { PlayerInfo } from '@/lib/ws';

interface PlayerListProps {
  players: PlayerInfo[];
  hostId: string | null;
  currentPlayerId: string | null;
  gameStatus: string;
  onStartGame?: () => void;
  isRoomFull?: boolean;
}

export default function PlayerList({
  players,
  hostId,
  currentPlayerId,
  gameStatus,
  onStartGame,
  isRoomFull,
}: PlayerListProps) {
  const isHost = currentPlayerId === hostId;
  const canStart = isHost && players.length === 2 && gameStatus === 'lobby' && !isRoomFull;
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Players</h2>
      
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3 bg-gray-700 rounded-md"
          >
            <span className="font-medium">{player.name}</span>
            <div className="flex items-center gap-2">
              {player.id === hostId && (
                <span className="px-2 py-1 text-xs bg-yellow-600 rounded">Host</span>
              )}
              {player.id === currentPlayerId && (
                <span className="px-2 py-1 text-xs bg-blue-600 rounded">You</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {gameStatus === 'lobby' && (
        <div className="mt-4">
          <button
            onClick={onStartGame}
            disabled={!isHost || isRoomFull || players.length < 2}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
          >
            Start Game
          </button>
        </div>
      )}
    </div>
  );
}
