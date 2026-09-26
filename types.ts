export type Player = 1 | 2;

export interface Point {
  x: number;
  y: number;
}

// A square of a piece. Bridge squares may pass over opponent squares.
export interface Cell extends Point {
  bridge?: boolean;
}

export interface Piece {
  id: string;
  shape: Cell[];
  size: number;
}

export interface PlacedPiece {
  id: string;
  playerId: Player;
  origin: Point;
  shape: Cell[];
  instanceId: string; // Unique ID for this specific placement on board
}

export interface ScoreBreakdown {
  unplaced: number;  // negative: squares left in hand
  neutral: number;   // squares held in the neutral zone
  surround: number;  // points from surrounding opponent pieces
  allPlaced: number; // bonus for placing every piece
  total: number;
}

export type EndReason = 'blocked' | 'resign' | 'timeout';

export interface GameState {
  board: (Player | null)[][];
  currentPlayer: Player;
  turn: number;
  scores: { 1: number; 2: number };
  breakdown: { 1: ScoreBreakdown; 2: ScoreBreakdown };
  player1Pieces: Piece[];
  player2Pieces: Piece[];
  placedHistory: PlacedPiece[];
  surrounded: string[]; // instanceIds of pieces that have been fully surrounded
  gameOver: boolean;
  endReason: EndReason | null;
  winner: Player | 'Draw' | null;
  skipped: Player | null; // player whose turn was skipped because they had no moves
  lastPlacement: PlacedPiece | null;
  timeLimit: number | null; // Total time in seconds
  timers: { 1: number; 2: number }; // Current remaining time in seconds
}
