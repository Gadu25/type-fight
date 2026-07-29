'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { createWebSocket, sendMessage, ServerMessage } from '@/lib/ws'
import PlayerList from '@/components/PlayerList'
import TypingArea from '@/components/TypingArea'
import Countdown from '@/components/Countdown'
import Results from '@/components/Results'
import ProfilePanel from '@/components/ProfilePanel'
import ProfileToggle from '@/components/ProfileToggle'
import NamePromptModal from '@/components/NamePromptModal'
import Toast from '@/components/Toast'
import AttackSelector from '@/components/AttackSelector'
import HealthBar from '@/components/HealthBar'
import BattleTimer from '@/components/BattleTimer'
import { getAccount, createAccount, updateMatchHistory } from '@/lib/account'
import { getRandomPhrase } from '@/lib/words'

type GameState = 'lobby' | 'countdown' | 'playing' | 'finished'

interface Player {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  hp?: number
  isAlive?: boolean
}

const BATTLE_TIME_LIMIT = 120

const attackDefs: Record<string, number> = {
  quick: 80,
  normal: 180,
  heavy: 350,
  ultimate: 600,
}

export default function RoomPage() {
  const params = useParams()
  const roomID = params.id as string

  const [playerId, setPlayerId] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameState>('lobby')
  const [currentAttack, setCurrentAttack] = useState<string>('')
  const [currentPhrase, setCurrentPhrase] = useState<string>('')
  const [currentDamage, setCurrentDamage] = useState<number>(0)
  const [playerHP, setPlayerHP] = useState<number>(1000)
  const [opponentHP, setOpponentHP] = useState<number>(1000)
  const [winner, setWinner] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(BATTLE_TIME_LIMIT)
  const [isReady, setIsReady] = useState<boolean>(false)
  const [opponentReady, setOpponentReady] = useState<boolean>(false)
  const [playAgainRequested, setPlayAgainRequested] = useState<boolean>(false)
  const [showNameModal, setShowNameModal] = useState<boolean>(false)
  const [showProfile, setShowProfile] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)
  const [isRoomFull, setIsRoomFull] = useState<boolean>(false)
  const [results, setResults] = useState<Array<{ player_id: string; name: string; wpm: number; accuracy: number; position: number }> | null>(null)
  const [playerDamageFlash, setPlayerDamageFlash] = useState<number>(0)
  const [opponentDamageFlash, setOpponentDamageFlash] = useState<number>(0)

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gameOverProcessedRef = useRef<boolean>(false)
  const handleMessageRef = useRef<(message: ServerMessage) => void>(() => {})
  const playersRef = useRef<Player[]>([])
  const totalCorrectCharsRef = useRef<number>(0)
  const totalKeystrokesRef = useRef<number>(0)
  const gameStartTimeRef = useRef<number>(0)
  const gameStateRef = useRef<GameState>('lobby')
  const phrasePoolsRef = useRef<Record<string, string[]> | null>(null)

  useEffect(() => {
    playersRef.current = players
  }, [players])

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  const handleJoinMessage = useCallback(() => {
    const account = getAccount()
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'join', player_name: account?.name || 'Player' })
    }
  }, [])

  useEffect(() => {
    const account = getAccount()
    const serverPlayerId = localStorage.getItem('playerId')
    const effectivePlayerId = serverPlayerId || account?.id || null

    if (!effectivePlayerId) {
      setShowNameModal(true)
      return
    }

    setPlayerId(effectivePlayerId)
    const ws = createWebSocket(
      roomID,
      (msg) => handleMessageRef.current(msg),
      effectivePlayerId || undefined,
      handleJoinMessage,
      () => {
        if (gameStateRef.current === 'playing') {
          setToastMessage('Connection lost')
        }
      },
    )
    wsRef.current = ws

    return () => {
      ws.close()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [roomID, handleJoinMessage])

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'player_list':
        if (message.players) {
          setPlayers(message.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: false,
            isHost: false,
            hp: 1000,
            isAlive: true
          })))
          if (message.host_id) {
            setHostId(message.host_id)
          }
          if (message.your_player_id) {
            setPlayerId(message.your_player_id)
          }
        }
        break

      case 'player_joined':
        if (message.player) {
          setPlayers(prev => {
            const exists = prev.some(p => p.id === message.player!.id)
            if (exists) return prev
            return [...prev, {
              id: message.player!.id,
              name: message.player!.name,
              ready: false,
              isHost: false,
              hp: 1000,
              isAlive: true
            }]
          })
        }
        break

      case 'game_start':
        if (message.players) {
          const battlePlayers = message.players
          setPlayers(battlePlayers.map(p => ({
            id: p.id,
            name: p.name,
            ready: true,
            isHost: false,
            hp: 1000,
            isAlive: true
          })))
          setGameState('countdown')
          setPlayerHP(1000)
          setOpponentHP(1000)
          setIsReady(false)
          setOpponentReady(false)
          setPlayAgainRequested(false)
          gameOverProcessedRef.current = false
          totalCorrectCharsRef.current = 0
          totalKeystrokesRef.current = 0
          gameStartTimeRef.current = 0
          setPlayerDamageFlash(0)
          setOpponentDamageFlash(0)

          if (message.host_id) {
            setHostId(message.host_id)
          }

          const me = battlePlayers.find(p => p.id === playerId)
          if (!me && battlePlayers.length > 0) {
            setPlayerId(battlePlayers[0].id)
          }
        }
        break

      case 'game_setup':
        if (message.phrase_pools) {
          phrasePoolsRef.current = message.phrase_pools
        }
        break

      case 'hp_update':
        if (message.hp_update) {
          if (message.hp_update.playerID === playerId) {
            setPlayerHP(message.hp_update.hp)
            setPlayerDamageFlash(message.hp_update.damage)
            setTimeout(() => setPlayerDamageFlash(0), 500)
            if (message.hp_update.hp <= 0 && !gameOverProcessedRef.current) {
              gameOverProcessedRef.current = true
              setWinner(message.hp_update.attacker)
              const opponent = playersRef.current.find(p => p.id === message.hp_update!.attacker)
              const elapsed = (Date.now() - gameStartTimeRef.current) / 60000
              const wpm = elapsed > 0 ? Math.round(totalCorrectCharsRef.current / 5 / elapsed) : 0
              const accuracy = totalKeystrokesRef.current > 0 ? Math.round((totalCorrectCharsRef.current / totalKeystrokesRef.current) * 100) : 0
              updateMatchHistory({
                opponentName: opponent?.name || 'Opponent',
                winner: false,
                wpm,
                accuracy,
                timestamp: Date.now(),
              })
              setTimeout(() => setGameState('finished'), 300)
            }
          } else {
            setOpponentHP(message.hp_update.hp)
            setOpponentDamageFlash(message.hp_update.damage)
            setTimeout(() => setOpponentDamageFlash(0), 500)
            if (message.hp_update.hp <= 0 && !gameOverProcessedRef.current) {
              gameOverProcessedRef.current = true
              setWinner(playerId || '')
              const opponent = playersRef.current.find(p => p.id === message.hp_update!.playerID)
              const elapsed = (Date.now() - gameStartTimeRef.current) / 60000
              const wpm = elapsed > 0 ? Math.round(totalCorrectCharsRef.current / 5 / elapsed) : 0
              const accuracy = totalKeystrokesRef.current > 0 ? Math.round((totalCorrectCharsRef.current / totalKeystrokesRef.current) * 100) : 0
              updateMatchHistory({
                opponentName: opponent?.name || 'Opponent',
                winner: true,
                wpm,
                accuracy,
                timestamp: Date.now(),
              })
              setTimeout(() => setGameState('finished'), 600)
            }
          }
        }
        break

      case 'player_left':
        if (message.player_left) {
          setPlayers(message.player_left.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: false,
            isHost: message.player_left!.new_host_id ? p.id === message.player_left!.new_host_id : false,
            hp: currentPlayer?.hp || 1000,
            isAlive: true,
          })))
          if (message.player_left.new_host_id) {
            setHostId(message.player_left.new_host_id)
          }
          if (gameState === 'playing') {
            setToastMessage('Opponent disconnected')
          }
        }
        break

      case 'player_defeated':
        break

      case 'battle_over':
        if (message.battle_over && !gameOverProcessedRef.current) {
          gameOverProcessedRef.current = true
          setWinner(message.battle_over.winner)
          setTimeout(() => setGameState('finished'), 600)
        }
        break

      case 'player_ready':
        if (message.ready_player_id) {
          if (message.ready_player_id === playerId) {
            setIsReady(true)
          } else {
            setOpponentReady(true)
          }
        }
        break

      case 'play_again_request':
        setPlayAgainRequested(true)
        break

      case 'return_to_lobby':
        setGameState('lobby')
        setPlayers([])
        setHostId(null)
        setIsReady(false)
        setOpponentReady(false)
        setPlayAgainRequested(false)
        setCurrentAttack('')
        setCurrentPhrase('')
        setPlayerHP(1000)
        setOpponentHP(1000)
        setWinner('')
        setResults(null)
        gameOverProcessedRef.current = false
        totalCorrectCharsRef.current = 0
        totalKeystrokesRef.current = 0
        gameStartTimeRef.current = 0
        setPlayerDamageFlash(0)
        setOpponentDamageFlash(0)
        break

      case 'error':
        setToastMessage(message.error?.message || 'An error occurred')
        if (message.error?.message === 'room is full') {
          setIsRoomFull(true)
        }
        break

      default:
        break
    }
  }, [playerId, hostId])

  useEffect(() => {
    handleMessageRef.current = handleMessage
  }, [handleMessage])

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState])

  useEffect(() => {
    if (timeLeft > 0 || gameState !== 'playing' || gameOverProcessedRef.current) return
    gameOverProcessedRef.current = true
    if (playerHP > opponentHP) {
      setWinner(playerId || '')
      const opponent = playersRef.current.find(p => p.id !== playerId)
      const elapsed = (Date.now() - gameStartTimeRef.current) / 60000
      const wpm = elapsed > 0 ? Math.round(totalCorrectCharsRef.current / 5 / elapsed) : 0
      const accuracy = totalKeystrokesRef.current > 0 ? Math.round((totalCorrectCharsRef.current / totalKeystrokesRef.current) * 100) : 0
      updateMatchHistory({
        opponentName: opponent?.name || 'Opponent',
        winner: true,
        wpm,
        accuracy,
        timestamp: Date.now(),
      })
    } else if (opponentHP > playerHP) {
      const attacker = playersRef.current.find(p => p.id !== playerId)
      setWinner(attacker?.id || '')
      const elapsed = (Date.now() - gameStartTimeRef.current) / 60000
      const wpm = elapsed > 0 ? Math.round(totalCorrectCharsRef.current / 5 / elapsed) : 0
      const accuracy = totalKeystrokesRef.current > 0 ? Math.round((totalCorrectCharsRef.current / totalKeystrokesRef.current) * 100) : 0
      updateMatchHistory({
        opponentName: attacker?.name || 'Opponent',
        winner: false,
        wpm,
        accuracy,
        timestamp: Date.now(),
      })
    } else {
      setWinner('')
    }
    setTimeout(() => setGameState('finished'), 600)
  }, [timeLeft, gameState, playerId, playerHP, opponentHP])

  const handleSelectAttack = useCallback((tier: 'quick' | 'normal' | 'heavy' | 'ultimate') => {
    const phrase = getRandomPhrase(tier)
    setCurrentPhrase(phrase)
    setCurrentAttack(tier)
    const def = attackDefs[tier]
    setCurrentDamage(def)
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'select_attack', select_attack: { tier } })
    }
  }, [])

  const handleAttackComplete = useCallback((result: { correct: number; total: number }) => {
    totalCorrectCharsRef.current += result.correct
    totalKeystrokesRef.current += result.total
    if (wsRef.current && currentAttack) {
      sendMessage(wsRef.current, {
        type: 'attack_complete',
        attack_complete: {
          tier: currentAttack as 'quick' | 'normal' | 'heavy' | 'ultimate',
          phrase: currentPhrase,
          correct: result.correct,
          total: result.total,
        },
      })
    }
    setCurrentPhrase('')
    setCurrentAttack('')
  }, [currentAttack, currentPhrase])

  const handleReady = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'ready' })
      setIsReady(true)
    }
  }, [])

  const handleStartGame = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'start_game' })
    }
  }, [])

  const handlePlayAgain = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'play_again' })
    }
  }, [])

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing')
    setTimeLeft(BATTLE_TIME_LIMIT)
    gameStartTimeRef.current = Date.now()
    totalCorrectCharsRef.current = 0
    totalKeystrokesRef.current = 0
  }, [])

  const handleCopyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomID)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [roomID])

  const handleNameSubmitted = useCallback((name: string) => {
    const account = createAccount(name)
    const serverPlayerId = localStorage.getItem('playerId')
    const effectivePlayerId = serverPlayerId || account.id
    setPlayerId(effectivePlayerId)
    setShowNameModal(false)

    const ws = createWebSocket(roomID, (msg) => handleMessageRef.current(msg), effectivePlayerId || undefined, handleJoinMessage)
    wsRef.current = ws
  }, [roomID, handleJoinMessage])

  const isHost = playerId === hostId
  const currentPlayer = players.find(p => p.id === playerId)
  const opponentPlayer = players.find(p => p.id !== playerId)

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Image
              src="/images/iconv2.webp"
              alt="Type Fight"
              width={80}
              height={80}
              className="rounded"
            />
            <h1 className="text-2xl font-bold">Type Fight</h1>
          </div>
          <div className="flex items-center gap-4">
            <ProfileToggle onClick={() => setShowProfile(true)} />
            <button
              onClick={handleCopyRoomCode}
              className="px-3 py-1 bg-gray-800 rounded text-sm"
            >
              {copied ? 'Copied!' : roomID}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {(gameState === 'lobby' || gameState === 'finished') && (
            <div className="lg:col-span-1">
              <PlayerList
                players={players}
                hostId={hostId}
                currentPlayerId={playerId}
                gameStatus={gameState}
                onStartGame={handleStartGame}
                onReady={handleReady}
                isRoomFull={isRoomFull}
                isReady={isReady}
                opponentReady={opponentReady}
              />
            </div>
          )}

          <div className={gameState === 'lobby' || gameState === 'finished' ? 'lg:col-span-2' : 'lg:col-span-3'}>
            {gameState === 'lobby' && (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                {isRoomFull ? (
                  <>
                    <p className="text-red-400 font-semibold text-lg">Room is Full</p>
                    <p className="text-gray-400 mt-2">This match already has 2 players</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400">Waiting for game to start...</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Share this room code with a friend: <span className="font-mono text-white">{roomID}</span>
                    </p>
                  </>
                )}
              </div>
            )}

            {(gameState === 'countdown' || gameState === 'playing') && (
              <div className={gameState === 'countdown' ? 'blur-sm pointer-events-none' : ''}>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="w-full"
                      style={playerDamageFlash > 0 ? {
                        animation: `damage-shake ${0.3 + (opponentDamageFlash / 600) * 0.4}s ease-out`,
                      } : undefined}
                    >
                      <HealthBar
                        name={currentPlayer?.name || 'You'}
                        hp={playerHP}
                        maxHp={1000}
                      />
                    </div>
                    <BattleTimer timeLeft={timeLeft} />
                    <div
                      className="w-full"
                      style={opponentDamageFlash > 0 ? {
                        animation: `damage-shake ${0.3 + (opponentDamageFlash / 600) * 0.4}s ease-out`,
                      } : undefined}
                    >
                      <HealthBar
                        name={opponentPlayer?.name || 'Opponent'}
                        hp={opponentHP}
                        maxHp={1000}
                      />
                    </div>
                  </div>

                  {currentPhrase && (
                    <TypingArea
                      phrase={currentPhrase}
                      onComplete={handleAttackComplete}
                      damageFlash={playerDamageFlash}
                    />
                  )}

                  {currentAttack && (
                    <div className="text-center text-gray-400">
                      Attack: {currentAttack.charAt(0).toUpperCase() + currentAttack.slice(1)} ({currentDamage} dmg)
                    </div>
                  )}
                </div>
              </div>
            )}

            {gameState === 'countdown' && (
              <Countdown onComplete={handleCountdownComplete} />
            )}

            {gameState === 'finished' && (
              <Results
                results={results || []}
                winner={winner || null}
                currentPlayerId={playerId}
                onPlayAgain={handlePlayAgain}
                playAgainRequested={playAgainRequested}
              />
            )}
          </div>
        </div>

        {(gameState === 'countdown' || gameState === 'playing') && (
          <div className="mt-6 flex justify-center">
            <AttackSelector
              onSelect={handleSelectAttack}
              currentAttack={currentAttack}
              disabled={gameState !== 'playing'}
            />
          </div>
        )}
      </div>

      <ProfilePanel isOpen={showProfile} onClose={() => setShowProfile(false)} />

      {toastMessage && (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage('')}
        />
      )}

      {showNameModal && (
        <NamePromptModal onNameSubmitted={handleNameSubmitted} />
      )}
    </main>
  )
}
