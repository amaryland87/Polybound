
export type Player = 1 | 2;

export interface Point {
  x: number;
  y: number;
}

export interface Piece {
  id: string;
  shape: Point[];
  size: number;
  bridgeIndices?: number[]; // Indices of the points in 'shape' that act as bridges
}

export interface PlacedPiece {
  id: string;
  playerId: Player;
  origin: Point;
  shape: Point[];
  instanceId: string; // Unique ID for this specific placement on board
}

export interface GameState {
  board: (number | null)[][];
  currentPlayer: Player;
  scores: { 1: number; 2: number };
  player1Pieces: Piece[];
  player2Pieces: Piece[];
  placedHistory: PlacedPiece[];
  gameOver: boolean;
  passCount: number;
  winner: Player | 'Draw' | null;
  lastPlacement: PlacedPiece | null;
  timeLimit: number | null; // Total time in seconds
  timers: { 1: number; 2: number }; // Current remaining time in seconds
}
