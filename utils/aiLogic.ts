
import { Player, Piece, Point } from '../types';
import { BOARD_SIZE } from '../constants';
import { isValidMove, rotatePiece, flipPiece, normalizeShape, isPointInNeutralZone, checkSurroundings } from './gameLogic';

export type AIDifficulty = 'Easy' | 'Medium' | 'Hard';

interface EvaluatedMove {
  piece: Piece;
  origin: Point;
  score: number;
}

/**
 * Finds all valid placements for a set of pieces.
 * Returns an array of possible moves.
 */
function findAllValidMoves(
  player: Player,
  pieces: Piece[],
  board: (number | null)[][],
  placedHistory: any[]
): EvaluatedMove[] {
  const isFirstMove = placedHistory.filter(p => p.playerId === player).length === 0;
  const possibleMoves: EvaluatedMove[] = [];

  for (const originalPiece of pieces) {
    // Try all 8 orientations
    const orientations: Piece[] = [];
    let currentShape = originalPiece.shape;

    for (let r = 0; r < 4; r++) {
      orientations.push({ ...originalPiece, shape: normalizeShape(currentShape) });
      orientations.push({ ...originalPiece, shape: normalizeShape(flipPiece(currentShape)) });
      currentShape = rotatePiece(currentShape);
    }

    // De-duplicate orientations based on normalized shapes
    const uniqueOrientations: Piece[] = [];
    const seenShapes = new Set<string>();
    for (const orient of orientations) {
      const shapeStr = JSON.stringify(orient.shape);
      if (!seenShapes.has(shapeStr)) {
        uniqueOrientations.push(orient);
        seenShapes.add(shapeStr);
      }
    }

    // Check every position on the board
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const origin = { x, y };
        for (const piece of uniqueOrientations) {
          if (isValidMove(piece.shape, origin, player, board, isFirstMove)) {
            possibleMoves.push({ piece, origin, score: 0 });
          }
        }
      }
    }
  }

  return possibleMoves;
}

/**
 * Checks if a player has at least one valid move.
 */
export function canPlayerMove(
  player: Player,
  pieces: Piece[],
  board: (number | null)[][],
  placedHistory: any[]
): boolean {
  const isFirstMove = placedHistory.filter(p => p.playerId === player).length === 0;
  
  for (const originalPiece of pieces) {
    // Generate unique orientations
    const orientations: Point[][] = [];
    let currentShape = originalPiece.shape;
    for (let r = 0; r < 4; r++) {
      orientations.push(normalizeShape(currentShape));
      orientations.push(normalizeShape(flipPiece(currentShape)));
      currentShape = rotatePiece(currentShape);
    }
    const uniqueShapes = Array.from(new Set(orientations.map(s => JSON.stringify(s)))).map(s => JSON.parse(s) as Point[]);

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        for (const shape of uniqueShapes) {
          if (isValidMove(shape, { x, y }, player, board, isFirstMove)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function getAIMove(
  player: Player,
  pieces: Piece[],
  board: (number | null)[][],
  placedHistory: any[],
  difficulty: AIDifficulty
): EvaluatedMove | null {
  const moves = findAllValidMoves(player, pieces, board, placedHistory);

  if (moves.length === 0) return null;

  if (difficulty === 'Easy') {
    // Easy: Mostly random, but slightly prefers bigger pieces
    const sorted = moves.sort((a, b) => (b.piece.size + Math.random() * 5) - (a.piece.size + Math.random() * 5));
    return sorted[0];
  }

  const opponentId = player === 1 ? 2 : 1;

  // Medium and Hard evaluate scores
  for (const move of moves) {
    let score = move.piece.size * 10; // Favor bigger pieces

    // Center preference
    const centerDist = move.piece.shape.reduce((acc, p) => {
      const ax = p.x + move.origin.x;
      const ay = p.y + move.origin.y;
      return acc + (Math.abs(ax - 6.5) + Math.abs(ay - 6.5));
    }, 0) / move.piece.size;
    
    score += (14 - centerDist) * 2;

    if (difficulty === 'Hard') {
      // Neutral Zone bonus
      const neutralZoneCount = move.piece.shape.filter(p => isPointInNeutralZone(p.x + move.origin.x, p.y + move.origin.y)).length;
      score += neutralZoneCount * 15;

      // Simulate board to check for surroundings
      const tempBoard = board.map(row => [...row]);
      move.piece.shape.forEach(p => {
        tempBoard[p.y + move.origin.y][p.x + move.origin.x] = player;
      });
      
      const newlySurrounded = checkSurroundings(tempBoard, placedHistory, opponentId);
      score += newlySurrounded.length * 100; // HUGE bonus for surrounding

      // Blocking potential
      let blockingScore = 0;
      move.piece.shape.forEach(p => {
        const ax = p.x + move.origin.x;
        const ay = p.y + move.origin.y;
        const neighbors = [{x: ax+1, y: ay}, {x: ax-1, y: ay}, {x: ax, y: ay+1}, {x: ax, y: ay-1}];
        neighbors.forEach(n => {
          if (n.x >= 0 && n.x < BOARD_SIZE && n.y >= 0 && n.y < BOARD_SIZE) {
            if (board[n.y][n.x] === opponentId) blockingScore += 5;
          }
        });
      });
      score += blockingScore;
    }

    move.score = score;
  }

  const sorted = moves.sort((a, b) => (b.score + Math.random() * 5) - (a.score + Math.random() * 5));
  return sorted[0];
}
