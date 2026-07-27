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
import { getAccount, createAccount } from '@/lib/account'

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

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gameOverProcessedRef = useRef<boolean>(false)
  const handleMessageRef = useRef<(message: ServerMessage) => void>(() => {})

  useEffect(() => {
    const account = getAccount()
    if (!account) {
      setShowNameModal(true)
      return
    }

    setPlayerId(account.id)
    const ws = createWebSocket(roomID, (msg) => handleMessageRef.current(msg))
    wsRef.current = ws
    sendMessage(ws, { type: 'join', player_name: account.name })

    return () => {
      ws.close()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [roomID])

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
          if (message.players.length > 0 && !hostId) {
            setHostId(message.players[0].id)
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

          const me = battlePlayers.find(p => p.id === playerId)
          const opponent = battlePlayers.find(p => p.id !== playerId)
          if (!me && battlePlayers.length > 0) {
            setPlayerId(battlePlayers[0].id)
          }
        }
        break

      case 'attack_phrase':
        if (message.attack_phrase) {
          setCurrentPhrase(message.attack_phrase.phrase)
          setCurrentAttack(message.attack_phrase.tier)
          setCurrentDamage(message.attack_phrase.damage)
        }
        break

      case 'hp_update':
        if (message.hp_update) {
          if (message.hp_update.playerID === playerId) {
            setPlayerHP(message.hp_update.hp)
          } else {
            setOpponentHP(message.hp_update.hp)
          }
        }
        break

      case 'player_defeated':
        break

      case 'battle_over':
        if (message.battle_over) {
          setWinner(message.battle_over.winner)
          setGameState('finished')
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

  const handleSelectAttack = useCallback((tier: 'quick' | 'normal' | 'heavy' | 'ultimate') => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'select_attack', select_attack: { tier } })
    }
  }, [])

  const handleAttackComplete = useCallback((result: { correct: number; total: number }) => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'attack_complete', attack_complete: result })
    }
    setCurrentPhrase('')
    setCurrentAttack('')
  }, [])

  const handleReady = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'ready' })
      setIsReady(true)
    }
  }, [])

  const handleStartGame = useCallback(() => {
    if (wsRef.current) {
      sendMessage(wsRef.current, { type: 'ready' })
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
  }, [])

  const handleCopyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomID)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [roomID])

  const handleNameSubmitted = useCallback((name: string) => {
    const account = createAccount(name)
    setPlayerId(account.id)
    setShowNameModal(false)

    const ws = createWebSocket(roomID, (msg) => handleMessageRef.current(msg))
    wsRef.current = ws
    sendMessage(ws, { type: 'join', player_name: account.name })
  }, [roomID])

  const isHost = playerId === hostId
  const currentPlayer = players.find(p => p.id === playerId)
  const opponentPlayer = players.find(p => p.id !== playerId)

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Image
              src="/images/icon.webp"
              alt="Type Fight"
              width={28}
              height={28}
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

          <div className="lg:col-span-2">
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
                    <HealthBar
                      name={currentPlayer?.name || 'You'}
                      hp={playerHP}
                      maxHp={1000}
                    />
                    <BattleTimer timeLeft={timeLeft} />
                    <HealthBar
                      name={opponentPlayer?.name || 'Opponent'}
                      hp={opponentHP}
                      maxHp={1000}
                    />
                  </div>

                  {currentPhrase && (
                    <TypingArea
                      phrase={currentPhrase}
                      onComplete={handleAttackComplete}
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

        <div className="mt-6 flex justify-center">
          <AttackSelector
            onSelect={handleSelectAttack}
            currentAttack={currentAttack}
            disabled={gameState !== 'playing'}
          />
        </div>
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
