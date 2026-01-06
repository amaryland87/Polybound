
import { Point, Player, Piece, PlacedPiece } from '../types';
import { BOARD_SIZE, NEUTRAL_ZONE_START, NEUTRAL_ZONE_END } from '../constants';

export function rotatePiece(shape: Point[]): Point[] {
  return shape.map(p => ({ x: -p.y, y: p.x }));
}

export function flipPiece(shape: Point[]): Point[] {
  return shape.map(p => ({ x: -p.x, y: p.y }));
}

export function normalizeShape(shape: Point[]): Point[] {
  const minX = Math.min(...shape.map(p => p.x));
  const minY = Math.min(...shape.map(p => p.y));
  return shape.map(p => ({ x: p.x - minX, y: p.y - minY })).sort((a, b) => a.x - b.x || a.y - b.y);
}

export function isPointInNeutralZone(x: number, y: number): boolean {
  return x >= NEUTRAL_ZONE_START && x <= NEUTRAL_ZONE_END && y >= NEUTRAL_ZONE_START && y <= NEUTRAL_ZONE_END;
}

export function isValidMove(
  shape: Point[],
  origin: Point,
  player: Player,
  board: (number | null)[][],
  isFirstMove: boolean,
  bridgeIndices?: number[]
): boolean {
  let touchesCorner = false;
  let touchesEdge = false;
  let touchesStartingEdge = false;

  const absoluteShape = shape.map(p => ({ x: p.x + origin.x, y: p.y + origin.y }));

  for (let i = 0; i < absoluteShape.length; i++) {
    const p = absoluteShape[i];
    const isBridgePart = bridgeIndices?.includes(i);

    // Check bounds
    if (p.x < 0 || p.x >= BOARD_SIZE || p.y < 0 || p.y >= BOARD_SIZE) return false;
    
    // Check overlap: Anchor parts MUST be on empty squares. Bridge parts can overlap anything.
    if (!isBridgePart) {
      if (board[p.y][p.x] !== null) return false;
    } else {
      // Bridge parts cannot overlap self
      if (board[p.y][p.x] === player) return false;
    }

    // First move logic: must touch starting edge
    if (isFirstMove) {
      if (player === 1 && p.y === BOARD_SIZE - 1) touchesStartingEdge = true;
      if (player === 2 && p.y === 0) touchesStartingEdge = true;
    }

    // Check neighbors
    const neighbors = [
      { x: p.x + 1, y: p.y, edge: true },
      { x: p.x - 1, y: p.y, edge: true },
      { x: p.x, y: p.y + 1, edge: true },
      { x: p.x, y: p.y - 1, edge: true },
      { x: p.x + 1, y: p.y + 1, edge: false },
      { x: p.x + 1, y: p.y - 1, edge: false },
      { x: p.x - 1, y: p.y + 1, edge: false },
      { x: p.x - 1, y: p.y - 1, edge: false },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= BOARD_SIZE || n.y < 0 || n.y >= BOARD_SIZE) continue;

      if (board[n.y][n.x] === player) {
        if (n.edge) {
          // Edge touch only in neutral zone or for bridge sections passing through?
          // To keep it clean, we follow standard rules: only corners outside neutral.
          const pInNeutral = isPointInNeutralZone(p.x, p.y);
          const nInNeutral = isPointInNeutralZone(n.x, n.y);
          if (!(pInNeutral && nInNeutral)) {
            touchesEdge = true;
          }
        } else {
          touchesCorner = true;
        }
      }
    }
  }

  if (isFirstMove) return touchesStartingEdge && !touchesEdge;
  return touchesCorner && !touchesEdge;
}

export function checkSurroundings(
  board: (number | null)[][],
  placedHistory: PlacedPiece[],
  opponentId: Player
): string[] {
  const surroundedIds: string[] = [];
  const opponentPieces = placedHistory.filter(p => p.playerId === opponentId);

  for (const piece of opponentPieces) {
    let isFullySurrounded = true;
    for (const block of piece.shape) {
      const ax = block.x + piece.origin.x;
      const ay = block.y + piece.origin.y;

      const orthoNeighbors = [
        { x: ax + 1, y: ay },
        { x: ax - 1, y: ay },
        { x: ax, y: ay + 1 },
        { x: ax, y: ay - 1 }
      ];

      for (const n of orthoNeighbors) {
        if (n.x >= 0 && n.x < BOARD_SIZE && n.y >= 0 && n.y < BOARD_SIZE) {
          if (board[n.y][n.x] === null) {
            isFullySurrounded = false;
            break;
          }
        }
      }
      if (!isFullySurrounded) break;
    }
    if (isFullySurrounded) surroundedIds.push(piece.instanceId);
  }
  return surroundedIds;
}

export function calculateScores(
  board: (number | null)[][],
  player1Pieces: Piece[],
  player2Pieces: Piece[],
  placedHistory: PlacedPiece[],
  gameOver: boolean,
  surroundedTracker: Set<string>
): { 1: number; 2: number } {
  const scores = { 1: 0, 2: 0 };

  const p1Unused = player1Pieces.reduce((acc, p) => acc + p.size, 0);
  const p2Unused = player2Pieces.reduce((acc, p) => acc + p.size, 0);
  scores[1] -= p1Unused;
  scores[2] -= p2Unused;

  if (player1Pieces.length === 0) scores[1] += 3;
  if (player2Pieces.length === 0) scores[2] += 3;

  for (let y = NEUTRAL_ZONE_START; y <= NEUTRAL_ZONE_END; y++) {
    for (let x = NEUTRAL_ZONE_START; x <= NEUTRAL_ZONE_END; x++) {
      if (board[y][x] === 1) scores[1] += 1;
      if (board[y][x] === 2) scores[2] += 1;
    }
  }

  surroundedTracker.forEach(instanceId => {
    const piece = placedHistory.find(ph => ph.instanceId === instanceId);
    if (piece) {
      const scoringPlayer = piece.playerId === 1 ? 2 : 1;
      scores[scoringPlayer] += 2;
    }
  });

  return scores;
}
