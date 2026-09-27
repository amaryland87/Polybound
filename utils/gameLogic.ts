import { Point, Cell, Player, Piece, PlacedPiece, GameState, ScoreBreakdown, EndReason } from '../types';
import { BOARD_SIZE, NEUTRAL_ZONE_START, NEUTRAL_ZONE_END, PIECES_TEMPLATE } from '../constants';

export type Board = (Player | null)[][];

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export const opponentOf = (player: Player): Player => (player === 1 ? 2 : 1);

export const inBounds = (x: number, y: number) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

export function rotatePiece(shape: Cell[]): Cell[] {
  return shape.map(p => ({ ...p, x: -p.y, y: p.x }));
}

export function flipPiece(shape: Cell[]): Cell[] {
  return shape.map(p => ({ ...p, x: -p.x }));
}

export function normalizeShape(shape: Cell[]): Cell[] {
  const minX = Math.min(...shape.map(p => p.x));
  const minY = Math.min(...shape.map(p => p.y));
  return shape
    .map(p => ({ ...p, x: p.x - minX, y: p.y - minY }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
}

export const shapeKey = (shape: Cell[]) => shape.map(p => `${p.x},${p.y}${p.bridge ? 'b' : ''}`).join('|');

// All distinct orientations (rotations and mirror images) of a shape.
export function getOrientations(shape: Cell[]): Cell[][] {
  const seen = new Set<string>();
  const result: Cell[][] = [];
  let current = shape;
  for (let r = 0; r < 4; r++) {
    for (const candidate of [normalizeShape(current), normalizeShape(flipPiece(current))]) {
      const key = shapeKey(candidate);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(candidate);
      }
    }
    current = rotatePiece(current);
  }
  return result;
}

const half = (shape: Cell[]) => ({
  x: Math.floor(Math.max(...shape.map(p => p.x)) / 2),
  y: Math.floor(Math.max(...shape.map(p => p.y)) / 2),
});

// Shift an origin so the whole shape stays on the board.
export function clampOrigin(shape: Cell[], origin: Point): Point {
  const w = Math.max(...shape.map(p => p.x));
  const h = Math.max(...shape.map(p => p.y));
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, BOARD_SIZE - 1 - max));
  return { x: clamp(origin.x, w), y: clamp(origin.y, h) };
}

// Origin that centres a shape on a pivot square. Rotating around the same pivot is reversible.
export function originAround(shape: Cell[], pivot: Point): Point {
  const c = half(shape);
  return clampOrigin(shape, { x: pivot.x - c.x, y: pivot.y - c.y });
}

// Inverse of originAround for an unclamped origin.
export function pivotOf(shape: Cell[], origin: Point): Point {
  const c = half(shape);
  return { x: origin.x + c.x, y: origin.y + c.y };
}

export function isPointInNeutralZone(x: number, y: number): boolean {
  return x >= NEUTRAL_ZONE_START && x <= NEUTRAL_ZONE_END && y >= NEUTRAL_ZONE_START && y <= NEUTRAL_ZONE_END;
}

export const hasPlaced = (history: PlacedPiece[], player: Player) => history.some(p => p.playerId === player);

export const startRow = (player: Player) => (player === 1 ? BOARD_SIZE - 1 : 0);

export function isValidMove(
  shape: Cell[],
  origin: Point,
  player: Player,
  board: Board,
  isFirstMove: boolean
): boolean {
  let touchesCorner = false;
  let touchesStartingEdge = false;
  const home = startRow(player);

  for (const cell of shape) {
    const x = cell.x + origin.x;
    const y = cell.y + origin.y;
    if (!inBounds(x, y)) return false;

    // Solid squares need an empty square. Bridge squares may pass over the opponent, never over yourself.
    const occupant = board[y][x];
    if (cell.bridge ? occupant === player : occupant !== null) return false;

    if (isFirstMove && y === home) touchesStartingEdge = true;

    for (const [dx, dy] of ORTHO) {
      const nx = x + dx, ny = y + dy;
      // Own pieces may only share edges inside the neutral zone
      if (inBounds(nx, ny) && board[ny][nx] === player && !(isPointInNeutralZone(x, y) && isPointInNeutralZone(nx, ny))) {
        return false;
      }
    }
    if (!touchesCorner) {
      for (const [dx, dy] of DIAG) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny) && board[ny][nx] === player) {
          touchesCorner = true;
          break;
        }
      }
    }
  }

  return isFirstMove ? touchesStartingEdge : touchesCorner;
}

export interface Move {
  piece: Piece; // piece with the oriented shape to place
  origin: Point;
}

export function findAllValidMoves(player: Player, pieces: Piece[], board: Board, history: PlacedPiece[]): Move[] {
  const isFirstMove = !hasPlaced(history, player);
  const moves: Move[] = [];
  for (const piece of pieces) {
    for (const shape of getOrientations(piece.shape)) {
      const w = Math.max(...shape.map(p => p.x));
      const h = Math.max(...shape.map(p => p.y));
      for (let y = 0; y + h < BOARD_SIZE; y++) {
        for (let x = 0; x + w < BOARD_SIZE; x++) {
          if (isValidMove(shape, { x, y }, player, board, isFirstMove)) {
            moves.push({ piece: { ...piece, shape }, origin: { x, y } });
          }
        }
      }
    }
  }
  return moves;
}

export function canPlacePiece(player: Player, piece: Piece, board: Board, history: PlacedPiece[]): boolean {
  const isFirstMove = !hasPlaced(history, player);
  for (const shape of getOrientations(piece.shape)) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (isValidMove(shape, { x, y }, player, board, isFirstMove)) return true;
      }
    }
  }
  return false;
}

export function canPlayerMove(player: Player, pieces: Piece[], board: Board, history: PlacedPiece[]): boolean {
  return pieces.some(piece => canPlacePiece(player, piece, board, history));
}

// Empty squares where a player could start a new piece (diagonal to own, not edge-adjacent outside the neutral zone).
export function getAnchors(player: Player, board: Board, history: PlacedPiece[]): Point[] {
  const anchors: Point[] = [];
  if (!hasPlaced(history, player)) {
    const y = startRow(player);
    for (let x = 0; x < BOARD_SIZE; x++) if (board[y][x] === null) anchors.push({ x, y });
    return anchors;
  }
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) continue;
      let blocked = false;
      for (const [dx, dy] of ORTHO) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny) && board[ny][nx] === player && !(isPointInNeutralZone(x, y) && isPointInNeutralZone(nx, ny))) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      if (DIAG.some(([dx, dy]) => inBounds(x + dx, y + dy) && board[y + dy][x + dx] === player)) {
        anchors.push({ x, y });
      }
    }
  }
  return anchors;
}

// Squares a placed piece actually owns (bridge squares that pass over the opponent are not owned).
export const ownedCells = (piece: PlacedPiece, board: Board): Point[] =>
  piece.shape
    .map(c => ({ x: c.x + piece.origin.x, y: c.y + piece.origin.y }))
    .filter(p => board[p.y][p.x] === piece.playerId);

// Pieces whose every edge touches another square or the board edge. Pass an owner to check only that player's pieces.
export function checkSurroundings(board: Board, history: PlacedPiece[], owner?: Player): string[] {
  const surroundedIds: string[] = [];
  for (const piece of history) {
    if (owner && piece.playerId !== owner) continue;
    const cells = ownedCells(piece, board);
    const enclosed = cells.every(({ x, y }) =>
      ORTHO.every(([dx, dy]) => !inBounds(x + dx, y + dy) || board[y + dy][x + dx] !== null)
    );
    if (enclosed) surroundedIds.push(piece.instanceId);
  }
  return surroundedIds;
}

export function calculateScores(
  board: Board,
  player1Pieces: Piece[],
  player2Pieces: Piece[],
  history: PlacedPiece[],
  surrounded: string[]
): { 1: ScoreBreakdown; 2: ScoreBreakdown } {
  const make = (pieces: Piece[]): ScoreBreakdown => ({
    unplaced: -pieces.reduce((acc, p) => acc + p.size, 0),
    neutral: 0,
    surround: 0,
    allPlaced: pieces.length === 0 ? 3 : 0,
    total: 0,
  });
  const result = { 1: make(player1Pieces), 2: make(player2Pieces) };

  for (let y = NEUTRAL_ZONE_START; y <= NEUTRAL_ZONE_END; y++) {
    for (let x = NEUTRAL_ZONE_START; x <= NEUTRAL_ZONE_END; x++) {
      const owner = board[y][x];
      if (owner) result[owner].neutral += 1;
    }
  }

  for (const id of surrounded) {
    const piece = history.find(ph => ph.instanceId === id);
    if (piece) result[opponentOf(piece.playerId)].surround += 2;
  }

  for (const p of [1, 2] as Player[]) {
    const b = result[p];
    b.total = b.unplaced + b.neutral + b.surround + b.allPlaced;
  }
  return result;
}

const piecesOf = (state: GameState, player: Player) => (player === 1 ? state.player1Pieces : state.player2Pieces);

function withScores(state: GameState): GameState {
  const breakdown = calculateScores(state.board, state.player1Pieces, state.player2Pieces, state.placedHistory, state.surrounded);
  return { ...state, breakdown, scores: { 1: breakdown[1].total, 2: breakdown[2].total } };
}

export function createInitialState(timeLimit: number | null, firstPlayer: Player = 1): GameState {
  return withScores({
    board: Array.from({ length: BOARD_SIZE }, () => Array<Player | null>(BOARD_SIZE).fill(null)),
    currentPlayer: firstPlayer,
    turn: 0,
    scores: { 1: 0, 2: 0 },
    breakdown: { 1: {} as ScoreBreakdown, 2: {} as ScoreBreakdown },
    player1Pieces: [...PIECES_TEMPLATE],
    player2Pieces: [...PIECES_TEMPLATE],
    placedHistory: [],
    surrounded: [],
    gameOver: false,
    endReason: null,
    winner: null,
    skipped: null,
    lastPlacement: null,
    timeLimit,
    timers: { 1: timeLimit ?? 0, 2: timeLimit ?? 0 },
  });
}

export function finishGame(state: GameState, reason: EndReason, loser?: Player): GameState {
  if (state.gameOver) return state;
  const scored = withScores(state);
  let winner: Player | 'Draw' = 'Draw';
  if (loser) winner = opponentOf(loser);
  else if (scored.scores[1] > scored.scores[2]) winner = 1;
  else if (scored.scores[2] > scored.scores[1]) winner = 2;
  return { ...scored, gameOver: true, endReason: reason, winner };
}

// Hands the turn to the next player able to move; ends the game when neither can.
function advanceTurn(state: GameState): GameState {
  const next = opponentOf(state.currentPlayer);
  const canMove = (p: Player) => canPlayerMove(p, piecesOf(state, p), state.board, state.placedHistory);
  if (canMove(next)) return { ...state, currentPlayer: next, turn: state.turn + 1, skipped: null };
  if (canMove(state.currentPlayer)) return { ...state, turn: state.turn + 1, skipped: next };
  return finishGame(state, 'blocked');
}

export function applyMove(state: GameState, piece: Piece, origin: Point): GameState {
  const player = state.currentPlayer;
  const board = state.board.map(row => [...row]);
  for (const c of piece.shape) {
    const x = c.x + origin.x, y = c.y + origin.y;
    // Bridges hop over opponent squares without capturing them
    if (board[y][x] === null) board[y][x] = player;
  }

  const placed: PlacedPiece = {
    id: piece.id,
    playerId: player,
    origin: { ...origin },
    shape: piece.shape.map(c => ({ ...c })),
    instanceId: `p${player}-${piece.id}-${state.turn}`,
  };
  const placedHistory = [...state.placedHistory, placed];
  // Either player's pieces can be boxed in, including by the mover's own pieces; the other side scores
  const newlySurrounded = checkSurroundings(board, placedHistory).filter(id => !state.surrounded.includes(id));

  const next = withScores({
    ...state,
    board,
    placedHistory,
    surrounded: [...state.surrounded, ...newlySurrounded],
    player1Pieces: player === 1 ? state.player1Pieces.filter(p => p.id !== piece.id) : state.player1Pieces,
    player2Pieces: player === 2 ? state.player2Pieces.filter(p => p.id !== piece.id) : state.player2Pieces,
    lastPlacement: placed,
  });
  return advanceTurn(next);
}
