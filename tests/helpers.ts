import { GameState, Player, PlacedPiece } from '../types';
import { BOARD_SIZE, PIECES_TEMPLATE } from '../constants';
import { Board, calculateScores, createInitialState } from '../utils/gameLogic';

export const emptyBoard = (): Board => Array.from({ length: BOARD_SIZE }, () => Array<Player | null>(BOARD_SIZE).fill(null));

export const piece = (id: string) => {
  const p = PIECES_TEMPLATE.find(t => t.id === id);
  if (!p) throw new Error(`no piece ${id}`);
  return p;
};

// Builds a state from raw squares: each entry is one placed piece given by absolute cells
export function stateWith(pieces: { player: Player; cells: [number, number][] }[], currentPlayer: Player = 1): GameState {
  const base = createInitialState(null, currentPlayer);
  const board = emptyBoard();
  const placedHistory: PlacedPiece[] = pieces.map((p, i) => {
    for (const [x, y] of p.cells) board[y][x] = p.player;
    return { id: `t${i}`, playerId: p.player, origin: { x: 0, y: 0 }, shape: p.cells.map(([x, y]) => ({ x, y })), instanceId: `t${i}` };
  });
  const breakdown = calculateScores(board, base.player1Pieces, base.player2Pieces, placedHistory, []);
  return { ...base, board, placedHistory, breakdown, scores: { 1: breakdown[1].total, 2: breakdown[2].total } };
}
