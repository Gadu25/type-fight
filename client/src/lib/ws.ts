export interface PlayerInfo {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  hp?: number
  isAlive?: boolean
}

export interface ResultInfo {
  winner: string
  loser: string
  winnerWPM: number
  loserWPM: number
}

export type ClientMessage =
  | { type: 'join'; payload: { name: string } }
  | { type: 'ready'; payload?: unknown }
  | { type: 'start_game'; payload?: unknown }
  | { type: 'select_attack'; payload: { tier: 'quick' | 'normal' | 'heavy' | 'ultimate' } }
  | { type: 'attack_complete'; payload: { correct: number; total: number } }
  | { type: 'switch_attack'; payload: { tier: 'quick' | 'normal' | 'heavy' | 'ultimate' } }
  | { type: 'play_again'; payload?: unknown }

export type ServerMessage =
  | { type: 'player_list'; payload: { players: PlayerInfo[] } }
  | { type: 'player_joined'; payload: PlayerInfo }
  | { type: 'game_start'; payload: { players: { id: string; name: string; hp: number }[] } }
  | { type: 'progress'; payload: { playerID: string; position: number; wpm: number } }
  | { type: 'player_finished'; payload: { playerID: string } }
  | { type: 'player_ready'; payload?: unknown }
  | { type: 'play_again_request'; payload?: unknown }
  | { type: 'return_to_lobby'; payload?: unknown }
  | { type: 'game_over'; payload: ResultInfo }
  | { type: 'error'; payload: { message: string } }
  | { type: 'attack_phrase'; payload: { phrase: string; tier: string; damage: number } }
  | { type: 'hp_update'; payload: { playerID: string; hp: number; attacker: string; damage: number } }
  | { type: 'player_defeated'; payload: { playerID: string } }
  | { type: 'battle_over'; payload: { winner: string; reason: string } }

export type MessageHandler = (message: ServerMessage) => void

export function createWebSocket(
  roomID: string,
  onMessage: MessageHandler,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (error: Event) => void
): WebSocket {
  const wsUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'ws://localhost:8080'
  const ws = new WebSocket(`${wsUrl}/ws/room/${roomID}`)

  ws.onopen = () => {
    if (onOpen) onOpen()
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as ServerMessage
      onMessage(message)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  ws.onclose = () => {
    if (onClose) onClose()
  }

  ws.onerror = (error) => {
    if (onError) onError(error)
  }

  return ws
}

export function sendMessage(ws: WebSocket | null, message: ClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}
