'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createWebSocket, sendMessage, ServerMessage, ResultInfo } from '@/lib/ws';
import PlayerList from '@/components/PlayerList';
import TypingArea from '@/components/TypingArea';
import Results from '@/components/Results';

type GameState = 'lobby' | 'playing' | 'finished';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [text, setText] = useState('');
  const [currentPosition, setCurrentPosition] = useState(0);
  const [results, setResults] = useState<ResultInfo[] | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const handleMessageRef = useRef<(message: ServerMessage) => void>(() => {});
  
  useEffect(() => {
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName');
    
    if (!storedPlayerName) {
      router.push('/');
      return;
    }
    
    setPlayerId(storedPlayerId);
    
    const websocket = createWebSocket(
      roomId,
      (msg) => handleMessageRef.current(msg),
      () => {
        sendMessage(websocket, {
          type: 'join',
          player_name: storedPlayerName,
        });
      }
    );
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [roomId, router]);
  
  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'player_list':
        if (message.players) {
          setPlayers(message.players);
          if (message.players.length > 0 && !hostId) {
            setHostId(message.players[0].id);
          }
        }
        break;
        
      case 'player_joined':
        if (message.player) {
          setPlayers((prev) => {
            const exists = prev.some(p => p.id === message.player!.id);
            if (exists) return prev;
            return [...prev, message.player!];
          });
        }
        break;
        
      case 'game_start':
        if (message.text && message.players) {
          setText(message.text);
          setPlayers(message.players);
          setGameState('playing');
          setCurrentPosition(0);
        }
        break;
        
      case 'progress':
        if (message.player_id === playerId) {
          setCurrentPosition(message.position || 0);
        }
        break;
        
      case 'game_over':
        if (message.results && message.winner !== undefined) {
          setResults(message.results);
          setWinner(message.winner);
          setGameState('finished');
        }
        break;
        
      case 'error':
        console.error('Server error:', message.error?.message);
        break;
    }
  }, [playerId, hostId]);
  
  useEffect(() => {
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);
  
  const handleKeystroke = (char: string, position: number) => {
    if (ws) {
      sendMessage(ws, {
        type: 'keystroke',
        char,
        position,
      });
      setCurrentPosition(position);
    }
  };
  
  const handleStartGame = () => {
    if (ws) {
      sendMessage(ws, {
        type: 'start_game',
      });
    }
  };
  
  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Type Fight</h1>
          <div className="text-sm text-gray-400">
            Room: {roomId}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <PlayerList
              players={players}
              hostId={hostId}
              currentPlayerId={playerId}
              gameStatus={gameState}
              onStartGame={handleStartGame}
            />
          </div>
          
          <div className="lg:col-span-2">
            {gameState === 'lobby' && (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <p className="text-gray-400">
                  Waiting for game to start...
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Share this room code with a friend: <span className="font-mono text-white">{roomId}</span>
                </p>
              </div>
            )}
            
            {gameState === 'playing' && (
              <TypingArea
                text={text}
                onKeystroke={handleKeystroke}
                isActive={true}
                currentPosition={currentPosition}
              />
            )}
            
            {gameState === 'finished' && results && (
              <Results
                results={results}
                winner={winner}
                currentPlayerId={playerId}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
