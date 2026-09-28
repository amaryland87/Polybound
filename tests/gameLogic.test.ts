import { describe, expect, it } from 'vitest';
import { PIECES_TEMPLATE } from '../constants';
import {
  applyMove, calculateScores, checkSurroundings, clampOrigin, createInitialState, finishGame, findAllValidMoves,
  getAnchors, getOrientations, isValidMove, originAround, pivotOf, canPlayerMove,
} from '../utils/gameLogic';
import { emptyBoard, piece, stateWith } from './helpers';

const mono = [{ x: 0, y: 0 }];

describe('getOrientations', () => {
  it.each([
    ['1-1', 1], ['2-1', 2], ['4-4', 1], ['5-1', 2], ['5-5', 1], ['4-5', 4], ['4-2', 8], ['A-1', 8], ['B-1', 2],
  ])('%s has %i distinct orientations', (id, count) => {
    expect(getOrientations(piece(id).shape)).toHaveLength(count);
  });

  it('keeps bridge squares in every orientation', () => {
    for (const shape of getOrientations(piece('B-2').shape)) {
      expect(shape.filter(c => c.bridge)).toHaveLength(2);
    }
  });
});

describe('isValidMove', () => {
  it('requires the first piece to touch the home row', () => {
    const board = emptyBoard();
    expect(isValidMove(mono, { x: 4, y: 13 }, 1, board, true)).toBe(true);
    expect(isValidMove(mono, { x: 4, y: 12 }, 1, board, true)).toBe(false);
    expect(isValidMove(mono, { x: 4, y: 0 }, 2, board, true)).toBe(true);
    expect(isValidMove(mono, { x: 4, y: 13 }, 2, board, true)).toBe(false);
  });

  it('rejects squares off the board or on occupied squares', () => {
    const board = emptyBoard();
    board[13][4] = 2;
    expect(isValidMove(mono, { x: 14, y: 13 }, 1, board, true)).toBe(false);
    expect(isValidMove(mono, { x: 4, y: 13 }, 1, board, true)).toBe(false);
  });

  it('needs a corner connection and no shared edge with your own pieces', () => {
    const { board } = stateWith([{ player: 1, cells: [[5, 13]] }]);
    expect(isValidMove(mono, { x: 6, y: 12 }, 1, board, false)).toBe(true);  // diagonal
    expect(isValidMove(mono, { x: 6, y: 13 }, 1, board, false)).toBe(false); // shares an edge
    expect(isValidMove(mono, { x: 8, y: 10 }, 1, board, false)).toBe(false); // not connected
  });

  it('allows touching opponent edges', () => {
    const { board } = stateWith([{ player: 1, cells: [[5, 13]] }, { player: 2, cells: [[7, 12]] }]);
    expect(isValidMove(mono, { x: 6, y: 12 }, 1, board, false)).toBe(true);
  });

  it('lets your own pieces share edges inside the neutral zone only', () => {
    const { board } = stateWith([{ player: 1, cells: [[6, 6]] }]);
    // Vertical domino: its top square shares an edge with (6,6), its bottom square supplies the corner
    const domino = [{ x: 0, y: 0 }, { x: 0, y: 1 }];
    expect(isValidMove(domino, { x: 7, y: 6 }, 1, board, false)).toBe(true);
    const edge = stateWith([{ player: 1, cells: [[8, 6]] }]).board;
    // (9,6) is outside the zone, so touching (8,6) along an edge is still forbidden
    expect(isValidMove(domino, { x: 9, y: 6 }, 1, edge, false)).toBe(false);
  });

  it('lets bridge squares hop opponent squares but never your own', () => {
    const bridge = getOrientations(piece('B-1').shape).find(s => s.every(c => c.x === 0))!; // vertical
    const { board } = stateWith([
      { player: 1, cells: [[7, 12]] },
      { player: 2, cells: [[8, 10]] },
    ]);
    expect(isValidMove(bridge, { x: 8, y: 8 }, 1, board, false)).toBe(true);
    // A solid square can't sit on the opponent
    expect(isValidMove(bridge, { x: 8, y: 7 }, 1, board, false)).toBe(false);
    const own = stateWith([{ player: 1, cells: [[7, 12]] }, { player: 1, cells: [[8, 10]] }]).board;
    expect(isValidMove(bridge, { x: 8, y: 8 }, 1, own, false)).toBe(false);
  });
});

describe('getAnchors', () => {
  it('offers the whole home row before the first move', () => {
    expect(getAnchors(1, emptyBoard(), [])).toHaveLength(14);
  });

  it('offers free diagonal squares afterwards', () => {
    const s = stateWith([{ player: 1, cells: [[5, 13]] }]);
    expect(getAnchors(1, s.board, s.placedHistory)).toEqual([{ x: 4, y: 12 }, { x: 6, y: 12 }]);
  });
});

describe('positioning helpers', () => {
  it('clamps a piece onto the board', () => {
    expect(clampOrigin(piece('5-1').shape, { x: 12, y: -3 })).toEqual({ x: 9, y: 0 });
  });

  it('round-trips a pivot through originAround and pivotOf', () => {
    const shape = piece('5-5').shape;
    expect(pivotOf(shape, originAround(shape, { x: 6, y: 6 }))).toEqual({ x: 6, y: 6 });
  });
});

describe('enclosure', () => {
  it('counts the board edge as a wall', () => {
    const s = stateWith([{ player: 2, cells: [[13, 0]] }, { player: 1, cells: [[12, 0]] }, { player: 1, cells: [[13, 1]] }]);
    expect(checkSurroundings(s.board, s.placedHistory, 2)).toEqual(['t0']);
  });

  it('scores enclosures for whoever closes them, including self-enclosure', () => {
    // Cobalt monomino in the corner with one side still open
    let s = stateWith([{ player: 2, cells: [[13, 0]] }, { player: 1, cells: [[13, 1]] }, { player: 1, cells: [[11, 2]] }]);
    s = applyMove(s, { ...piece('1-1') }, { x: 12, y: 0 }); // not a legal Crimson move (edge), but applyMove trusts callers
    expect(s.surrounded).toContain('t0');
    expect(s.breakdown[1].surround).toBe(2);

    // Cobalt closes the last gap around its own piece: Crimson still gets the points
    let own = stateWith([
      { player: 2, cells: [[13, 0]] }, { player: 1, cells: [[13, 1]] }, { player: 2, cells: [[12, 1]] },
    ], 2);
    own = applyMove(own, { ...piece('1-1') }, { x: 12, y: 0 });
    expect(own.surrounded).toContain('t0');
    expect(own.breakdown[1].surround).toBe(2);
    expect(own.breakdown[2].surround).toBe(0);
  });
});

describe('calculateScores', () => {
  it('adds up placed, neutral, enclosure and all-placed parts', () => {
    const board = emptyBoard();
    board[6][6] = 1;
    board[6][7] = 1;
    board[5][5] = 2;
    const history = [
      { id: 'x', playerId: 2 as const, origin: { x: 0, y: 0 }, shape: [{ x: 5, y: 5 }], instanceId: 'enclosed' },
    ];
    const scores = calculateScores(board, [piece('5-1')], [], history, ['enclosed']);
    expect(scores[1]).toEqual({ placed: 0, neutral: 2, surround: 2, allPlaced: 0, total: 4 });
    expect(scores[2]).toEqual({ placed: 1, neutral: 1, surround: 0, allPlaced: 3, total: 5 });
  });

  it('starts both players at zero', () => {
    expect(createInitialState(null).scores).toEqual({ 1: 0, 2: 0 });
  });

  it('awards every square plus the bonus once all pieces are placed', () => {
    const total = PIECES_TEMPLATE.reduce((a, p) => a + p.size, 0);
    const shape = Array.from({ length: total }, (_, i) => ({ x: i % 14, y: 13 - Math.floor(i / 14) }));
    const history = [{ id: 'all', playerId: 1 as const, origin: { x: 0, y: 0 }, shape, instanceId: 'all' }];
    expect(calculateScores(emptyBoard(), [], PIECES_TEMPLATE, history, [])[1]).toMatchObject({ placed: total, allPlaced: 3, total: total + 3 });
  });
});

describe('turn flow', () => {
  it('lets either player move first', () => {
    expect(createInitialState(null).currentPlayer).toBe(1);
    expect(createInitialState(360, 2).currentPlayer).toBe(2);
    expect(createInitialState(360, 2).timers).toEqual({ 1: 360, 2: 360 });
  });

  it('applies a move, removes the piece and passes the turn', () => {
    const s = applyMove(createInitialState(null), piece('5-1'), { x: 0, y: 13 });
    expect(s.currentPlayer).toBe(2);
    expect(s.turn).toBe(1);
    expect(s.player1Pieces.some(p => p.id === '5-1')).toBe(false);
    expect(s.board[13].slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(s.scores[1]).toBe(createInitialState(null).scores[1] + 5);
  });

  it('skips a player with no moves and ends when nobody can move', () => {
    // Cobalt has nothing left in hand, so Crimson keeps the turn
    const s = { ...createInitialState(null), player2Pieces: [] };
    const next = applyMove(s, piece('1-1'), { x: 0, y: 13 });
    expect(next.currentPlayer).toBe(1);
    expect(next.skipped).toBe(2);

    const last = { ...s, player1Pieces: [piece('1-1')] };
    const done = applyMove(last, piece('1-1'), { x: 0, y: 13 });
    expect(done.gameOver).toBe(true);
    expect(done.endReason).toBe('blocked');
  });

  it('finishGame picks the winner by score or by who gave up', () => {
    const s = createInitialState(null);
    expect(finishGame(s, 'blocked').winner).toBe('Draw');
    expect(finishGame(s, 'resign', 1).winner).toBe(2);
    expect(finishGame(s, 'timeout', 2).winner).toBe(1);
  });

  it('finds legal opening moves for every piece', () => {
    const moves = findAllValidMoves(1, PIECES_TEMPLATE, emptyBoard(), []);
    expect(new Set(moves.map(m => m.piece.id)).size).toBe(PIECES_TEMPLATE.length);
    expect(canPlayerMove(1, [], emptyBoard(), [])).toBe(false);
  });
});
