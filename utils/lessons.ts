// Guided practice puzzles. Each lesson sets up a board and gives Crimson a small hand;
// the player keeps moving (Cobalt never replies) until the goal is met.
import { GameState, PlacedPiece, Player, Piece, Point } from '../types';
import { PIECES_TEMPLATE } from '../constants';
import { applyMove, checkSurroundings, createInitialState, calculateScores } from './gameLogic';

export interface Lesson {
  title: string;
  goal: string;    // what to do
  success: string; // shown once the goal is met
  hand: string[];  // Crimson's piece ids
  setup: { player: Player; cells: [number, number][] }[];
  isComplete: (state: GameState) => boolean;
}

const crimsonPieces = (s: GameState) => s.placedHistory.filter(p => p.playerId === 1).length;

const line = (x: number, y: number, len: number, vertical: boolean): [number, number][] =>
  Array.from({ length: len }, (_, i) => (vertical ? [x, y + i] : [x + i, y]));

export const LESSONS: Lesson[] = [
  {
    title: 'Your first piece',
    goal: 'You are Crimson. Place any piece so it touches your home row, the glowing strip along the bottom edge.',
    success: 'Every game starts this way. Cobalt does the same from the top row.',
    hand: ['5-1', '4-4', '5-5'],
    setup: [],
    isComplete: s => crimsonPieces(s) >= 1,
  },
  {
    title: 'Corner to corner',
    goal: 'Add a piece that touches your red piece only at a corner. Pieces that share an edge with it turn grey, and the diamonds show every corner you can use.',
    success: 'Your pieces may never share an edge outside the neutral zone, so you spread out diagonally.',
    hand: ['4-2', '4-4', '3-2'],
    setup: [
      { player: 1, cells: line(5, 13, 3, false) },
      { player: 2, cells: line(8, 0, 4, false) },
    ],
    isComplete: s => crimsonPieces(s) >= 2,
  },
  {
    title: 'The neutral zone',
    goal: 'Inside the gold 4×4 zone your pieces may share edges. Pack at least 3 more of your squares into it.',
    success: 'Each square you hold in the neutral zone is worth +1 at the end.',
    hand: ['4-1', '3-1'],
    setup: [
      { player: 1, cells: [[5, 7], [6, 7], [5, 8], [6, 8]] },
      { player: 1, cells: line(7, 9, 4, true) },
      { player: 1, cells: [[8, 13]] },
      { player: 2, cells: line(10, 0, 5, true) },
    ],
    isComplete: s => s.breakdown[1].neutral >= 7,
  },
  {
    title: 'Bridge pieces',
    goal: "Cobalt has walled you in. Use the bridge piece: its dashed squares can hop over enemy squares. Get across the blue wall.",
    success: "The hopped square still belongs to Cobalt, but you're through to the other side.",
    hand: ['B-1'],
    setup: [
      { player: 1, cells: [[6, 12], [7, 12], [6, 13], [7, 13]] },
      { player: 2, cells: line(1, 10, 5, false) },
      { player: 2, cells: line(6, 10, 5, false) },
      { player: 2, cells: line(11, 10, 3, false) },
    ],
    isComplete: s => s.placedHistory.some(p => p.playerId === 1 && p.shape.some(c =>
      c.bridge && s.board[c.y + p.origin.y][c.x + p.origin.x] === 2)),
  },
  {
    title: 'Enclosing',
    goal: 'The Cobalt square in the top-right corner has two open sides left. Close both with one piece to enclose it.',
    success: 'A piece with every edge touching another square or the board edge is enclosed, and its opponent scores +2. Watch out: this counts your own pieces too.',
    hand: ['3-2', '1-1', '2-1'],
    setup: [
      { player: 2, cells: [[13, 0]] },
      { player: 2, cells: line(2, 0, 4, false) },
      { player: 1, cells: line(11, 2, 5, true) },
      { player: 1, cells: line(10, 7, 5, true) },
      { player: 1, cells: [[9, 12], [9, 13]] },
    ],
    isComplete: s => s.breakdown[1].surround >= 2,
  },
];

export function lessonState(lesson: Lesson): GameState {
  const base = createInitialState(null, 1);
  const board = base.board.map(row => [...row]);
  const placedHistory: PlacedPiece[] = lesson.setup.map((piece, i) => {
    for (const [x, y] of piece.cells) board[y][x] = piece.player;
    return {
      id: `lesson-${i}`,
      playerId: piece.player,
      origin: { x: 0, y: 0 },
      shape: piece.cells.map(([x, y]) => ({ x, y })),
      instanceId: `lesson-${i}`,
    };
  });
  const player1Pieces: Piece[] = lesson.hand.map(id => PIECES_TEMPLATE.find(p => p.id === id)!);
  const surrounded = checkSurroundings(board, placedHistory);
  const breakdown = calculateScores(board, player1Pieces, [], placedHistory, surrounded);
  return {
    ...base,
    board,
    placedHistory,
    surrounded,
    player1Pieces,
    player2Pieces: [],
    breakdown,
    scores: { 1: breakdown[1].total, 2: breakdown[2].total },
  };
}

// Apply a Crimson move and hand the turn straight back, since Cobalt never replies in a lesson.
export function applyLessonMove(state: GameState, piece: Piece, origin: Point): GameState {
  const next = applyMove(state, piece, origin);
  return { ...next, currentPlayer: 1, skipped: null, gameOver: false, endReason: null, winner: null };
}
