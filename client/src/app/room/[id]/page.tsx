'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createWebSocket, sendMessage, ServerMessage, ResultInfo } from '@/lib/ws';
import PlayerList from '@/components/PlayerList';
import TypingArea from '@/components/TypingArea';
import Results from '@/components/Results';
import EnemyPreview from '@/components/EnemyPreview';
import Toast from '@/components/Toast';

type GameState = 'lobby' | 'playing' | 'finished';

const GAME_TIME_LIMIT = 30;

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
  const [timeLeft, setTimeLeft] = useState(GAME_TIME_LIMIT);
  const [enemyPosition, setEnemyPosition] = useState(0);
  const [enemyName, setEnemyName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const handleMessageRef = useRef<(message: ServerMessage) => void>(() => {});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsOpenedRef = useRef(false);
  const pendingPositionRef = useRef(0);
  const lastSentPositionRef = useRef(0);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName');

    if (!storedPlayerName) {
      router.push('/');
      return;
    }

    setPlayerId(storedPlayerId);
    wsOpenedRef.current = false;

    const websocket = createWebSocket(
      roomId,
      (msg) => handleMessageRef.current(msg),
      () => {
        wsOpenedRef.current = true;
        sendMessage(websocket, {
          type: 'join',
          player_name: storedPlayerName,
        });
      }
    );
    setWs(websocket);

    return () => {
      if (wsOpenedRef.current) {
        websocket.close();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [roomId]);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'player_list':
        if (message.players) {
          setPlayers(message.players);
          if (message.players.length > 0 && !hostId) {
            setHostId(message.players[0].id);
          }
        }
        if (message.your_player_id && !localStorage.getItem('playerId')) {
          localStorage.setItem('playerId', message.your_player_id);
          setPlayerId(message.your_player_id);
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
          setTimeLeft(GAME_TIME_LIMIT);
          setEnemyPosition(0);
          setToastMessage(null);

          const enemy = message.players.find(p => p.id !== playerId);
          if (enemy) setEnemyName(enemy.name);

          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                if (timerRef.current) clearInterval(timerRef.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          // Sync position every 100ms
          pendingPositionRef.current = 0;
          lastSentPositionRef.current = 0;
          if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = setInterval(() => {
            if (ws && pendingPositionRef.current !== lastSentPositionRef.current) {
              sendMessage(ws, {
                type: 'keystroke',
                char: '',
                position: pendingPositionRef.current,
              });
              lastSentPositionRef.current = pendingPositionRef.current;
            }
          }, 100);
        }
        break;

      case 'progress':
        if (message.player_id === playerId) {
          setCurrentPosition(message.position || 0);
        } else {
          setEnemyPosition(message.position || 0);
          if (!enemyName && message.player_id) {
            const enemy = players.find(p => p.id === message.player_id);
            if (enemy) setEnemyName(enemy.name);
          }
        }
        break;

      case 'player_finished':
        if (message.player_finished && message.player_finished.id !== playerId) {
          setToastMessage(`${message.player_finished.name} finished the text!`);
        }
        break;

      case 'game_over':
        if (message.results && message.winner !== undefined) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
          setResults(message.results);
          setWinner(message.winner);
          setGameState('finished');
          setToastMessage(null);
        }
        break;

      case 'error':
        console.error('Server error:', message.error?.message);
        break;
    }
  }, [playerId, hostId, enemyName, players]);

  useEffect(() => {
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);

  const handleKeystroke = (char: string, position: number) => {
    pendingPositionRef.current = position;
    setCurrentPosition(position);
  };

  const handleStartGame = () => {
    if (ws) {
      sendMessage(ws, {
        type: 'start_game',
      });
    }
  };

  const timerColor = timeLeft <= 5 ? 'text-red-400' : timeLeft <= 10 ? 'text-yellow-400' : 'text-gray-400';

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Type Fight</h1>
          <div className="flex items-center gap-4">
            {gameState === 'playing' && (
              <div className={`text-2xl font-mono font-bold ${timerColor}`}>
                {timeLeft}s
              </div>
            )}
            <div className="text-sm text-gray-400">
              Room: {roomId}
            </div>
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
              <div className="space-y-4">
                {enemyName && (
                  <EnemyPreview
                    text={text}
                    enemyPosition={enemyPosition}
                    enemyName={enemyName}
                  />
                )}
                <TypingArea
                  text={text}
                  onKeystroke={handleKeystroke}
                  isActive={true}
                  currentPosition={currentPosition}
                />
              </div>
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
      {toastMessage && (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </main>
  );
}
