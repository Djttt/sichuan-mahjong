export type Suit = 'WAN' | 'TIAO' | 'TONG';

export interface TileData {
  id: string; // Unique identifier for React keys
  suit: Suit;
  rank: number; // 1-9
}

export type PlayerPosition = 'bottom' | 'right' | 'top' | 'left';

export interface Player {
  id: string; // PeerID or 'bot-x'
  name: string;
  position: PlayerPosition;
  hand: TileData[];
  discards: TileData[];
  melds: TileData[][];
  score: number;
  dingQue: Suit | null;
  isHu: boolean;
  avatar: string;
  isReady?: boolean;
  voiceCharacter?: string; // ID of the voice character
  skippedDiscardId?: string | null; // Tracks which discard id this player has explicitly passed
}

export type GamePhase = 'LOBBY' | 'DEALING' | 'DINGQUE' | 'PLAYING' | 'GAME_OVER';

export interface GameState {
  roomId: string; // For display
  isMultiplayer: boolean;
  phase: GamePhase;
  currentTurnPlayerId: string;
  remainingTiles: number;
  deck: TileData[]; // The actual deck of tiles
  players: Player[];
  lastDiscard: TileData | null;
  myPlayerId: string; // The ID of the local user
}

// Network Payloads
export type NetworkAction =
  | { type: 'JOIN'; player: Player }
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'ACTION_DISCARD'; playerId: string; tileId: string }
  | { type: 'ACTION_DINGQUE'; playerId: string; suit: Suit }
  | { type: 'ACTION_HU'; playerId: string }
  | { type: 'ACTION_PENG'; playerId: string }
  | { type: 'ACTION_GANG'; playerId: string; isWanGang?: boolean; targetTileId?: string }
  | { type: 'ACTION_RESTART' }
  | { type: 'ACTION_PASS'; playerId: string }
  | { type: 'ACTION_UPDATE_VOICE'; playerId: string; voiceCharacter: string };

export interface SocketMessage {
  roomId: string;
  action: NetworkAction;
}