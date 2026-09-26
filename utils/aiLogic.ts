import { Player, Piece, PlacedPiece } from '../types';
import { BOARD_SIZE } from '../constants';
import {
  Board, Move, findAllValidMoves, getAnchors, isPointInNeutralZone, checkSurroundings, opponentOf, hasPlaced,
} from './gameLogic';

export type AIDifficulty = 'Easy' | 'Medium' | 'Hard';

interface ScoredMove extends Move {
  score: number;
}

const CENTER = (BOARD_SIZE - 1) / 2;

function simulate(board: Board, move: Move, player: Player): Board {
  const next = board.map(row => [...row]);
  for (const c of move.piece.shape) {
    const x = c.x + move.origin.x, y = c.y + move.origin.y;
    if (next[y][x] === null) next[y][x] = player;
  }
  return next;
}

const simulateHistory = (history: PlacedPiece[], move: Move, player: Player): PlacedPiece[] => [
  ...history,
  { id: move.piece.id, playerId: player, origin: move.origin, shape: move.piece.shape, instanceId: `sim-${move.piece.id}` },
];

function immediateGain(board: Board, after: Board, history: PlacedPiece[], move: Move, player: Player): number {
  const opponent = opponentOf(player);
  const cells = move.piece.shape.map(c => ({ x: c.x + move.origin.x, y: c.y + move.origin.y }));
  const neutral = cells.filter(p => isPointInNeutralZone(p.x, p.y) && board[p.y][p.x] === null).length;
  const before = new Set(checkSurroundings(board, history, opponent));
  const surrounds = checkSurroundings(after, history, opponent).filter(id => !before.has(id)).length;
  // Each placed square avoids a -1 penalty at the end of the game
  return move.piece.size + neutral + surrounds * 2;
}

function evaluate(
  move: Move,
  player: Player,
  board: Board,
  history: PlacedPiece[],
  difficulty: AIDifficulty,
  myAnchorsBefore: number,
  oppAnchorsBefore: number,
): number {
  const opponent = opponentOf(player);
  const after = simulate(board, move, player);
  const cells = move.piece.shape.map(c => ({ x: c.x + move.origin.x, y: c.y + move.origin.y }));

  let score = immediateGain(board, after, history, move, player) * 10;

  // Push toward the centre and the opponent's side early on
  const centerDist = cells.reduce((acc, p) => acc + Math.abs(p.x - CENTER) + Math.abs(p.y - CENTER), 0) / cells.length;
  score += (BOARD_SIZE - centerDist) * (difficulty === 'Hard' ? 1.5 : 2);

  if (difficulty === 'Hard') {
    const newHistory = simulateHistory(history, move, player);
    const myAnchors = getAnchors(player, after, newHistory).length;
    const oppAnchors = hasPlaced(history, opponent) ? getAnchors(opponent, after, newHistory).length : oppAnchorsBefore;
    score += (myAnchors - myAnchorsBefore) * 2;   // keep options open
    score += (oppAnchorsBefore - oppAnchors) * 14; // close the opponent's options

    // Advance toward the enemy home row to claim territory
    const progress = cells.reduce((acc, p) => acc + (player === 2 ? p.y : BOARD_SIZE - 1 - p.y), 0) / cells.length;
    score += progress * (history.length < 10 ? 3 : 1);

    // Big pieces are harder to fit late, so play them first
    score += move.piece.size * move.piece.size * (history.length < 16 ? 2 : 0.5);
  }
  return score;
}

// Best greedy reply value for the opponent, used as a one-ply look-ahead penalty.
function bestReplyGain(board: Board, history: PlacedPiece[], player: Player, pieces: Piece[]): number {
  let best = 0;
  for (const reply of findAllValidMoves(player, pieces, board, history)) {
    const gain = immediateGain(board, simulate(board, reply, player), history, reply, player);
    if (gain > best) best = gain;
  }
  return best;
}

export function getAIMove(
  player: Player,
  pieces: Piece[],
  opponentPieces: Piece[],
  board: Board,
  history: PlacedPiece[],
  difficulty: AIDifficulty
): Move | null {
  const moves = findAllValidMoves(player, pieces, board, history);
  if (moves.length === 0) return null;

  if (difficulty === 'Easy') {
    // Mostly random, with a lean toward bigger pieces
    const weighted = moves.map(m => ({ m, w: Math.random() * (m.piece.size + 2) }));
    weighted.sort((a, b) => b.w - a.w);
    return weighted[0].m;
  }

  const opponent = opponentOf(player);
  const myAnchors = getAnchors(player, board, history).length;
  const oppAnchors = getAnchors(opponent, board, history).length;

  const scored: ScoredMove[] = moves.map(m => ({
    ...m,
    score: evaluate(m, player, board, history, difficulty, myAnchors, oppAnchors) + Math.random() * 4,
  }));
  scored.sort((a, b) => b.score - a.score);

  if (difficulty === 'Hard' && hasPlaced(history, opponent)) {
    // Check how the opponent could respond to the strongest candidates
    const candidates = scored.slice(0, 6);
    for (const c of candidates) {
      const after = simulate(board, c, player);
      c.score -= bestReplyGain(after, simulateHistory(history, c, player), opponent, opponentPieces) * 10;
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }
  return scored[0];
}
