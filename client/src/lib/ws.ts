export interface PlayerInfo {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  hp?: number
  isAlive?: boolean
}

export interface ResultInfo {
  player_id: string
  name: string
  wpm: number
  accuracy: number
  position: number
}

export type ClientMessage =
  | { type: 'join'; player_name: string }
  | { type: 'ready' }
  | { type: 'start_game' }
  | { type: 'select_attack'; select_attack: { tier: 'quick' | 'normal' | 'heavy' | 'ultimate' } }
  | { type: 'attack_complete'; attack_complete: { correct: number; total: number } }
  | { type: 'switch_attack'; switch_attack: { tier: 'quick' | 'normal' | 'heavy' | 'ultimate' } }
  | { type: 'play_again' }

export type ServerMessage =
  | { type: 'player_list'; players: PlayerInfo[]; host_id?: string; your_player_id?: string }
  | { type: 'player_joined'; player: PlayerInfo }
  | { type: 'game_start'; players: { id: string; name: string }[]; text: string; host_id?: string }
  | { type: 'progress'; player_id: string; position: number; wpm: number }
  | { type: 'player_finished'; player_finished: PlayerInfo }
  | { type: 'player_ready'; ready_player_id: string }
  | { type: 'play_again_request'; opponent_name: string }
  | { type: 'return_to_lobby'; return_to_lobby: boolean }
  | { type: 'game_over'; results: ResultInfo[]; winner: string }
  | { type: 'error'; error: { message: string } }
  | { type: 'attack_phrase'; attack_phrase: { phrase: string; tier: string; damage: number } }
  | { type: 'hp_update'; hp_update: { playerID: string; hp: number; attacker: string; damage: number } }
  | { type: 'player_defeated'; player_defeated: { playerID: string } }
  | { type: 'battle_over'; battle_over: { winner: string; reason: string } }
  | { type: 'player_left'; player_left: { playerID: string; new_host_id?: string; players: { id: string; name: string }[] } }

export type MessageHandler = (message: ServerMessage) => void

export function createWebSocket(
  roomID: string,
  onMessage: MessageHandler,
  playerID?: string,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (error: Event) => void
): WebSocket {
  const wsUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'ws://localhost:8080'
  const params = playerID ? `?player_id=${encodeURIComponent(playerID)}` : ''
  const ws = new WebSocket(`${wsUrl}/ws/room/${roomID}${params}`)

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
