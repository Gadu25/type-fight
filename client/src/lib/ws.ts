export type PlayerInfo = {
  id: string;
  name: string;
};

export type ResultInfo = {
  player_id: string;
  name: string;
  wpm: number;
  accuracy: number;
  position: number;
};

export type ClientMessage = {
  type: 'join' | 'ready' | 'start_game' | 'keystroke';
  player_name?: string;
  char?: string;
  position?: number;
};

export type ServerMessage = {
  type: string;
  player?: { id: string; name: string };
  text?: string;
  players?: Array<{ id: string; name: string }>;
  player_id?: string;
  your_player_id?: string;
  position?: number;
  wpm?: number;
  accuracy?: number;
  winner?: string;
  results?: Array<{
    player_id: string;
    name: string;
    wpm: number;
    accuracy: number;
    position: number;
  }>;
  error?: { message: string };
};

export type MessageHandler = (message: ServerMessage) => void;

export function createWebSocket(
  roomId: string,
  onMessage: MessageHandler,
  onOpen?: () => void
): WebSocket {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
  const playerId = localStorage.getItem('playerId') || '';
  const ws = new WebSocket(`${wsUrl}/ws/room/${roomId}?player_id=${playerId}`);
  
  ws.onopen = () => {
    onOpen?.();
  };
  
  ws.onmessage = (event) => {
    const message: ServerMessage = JSON.parse(event.data);
    onMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
}

export function sendMessage(ws: WebSocket, message: ClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
