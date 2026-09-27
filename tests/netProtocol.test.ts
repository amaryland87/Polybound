import { describe, expect, it } from 'vitest';
import { applyRemoteMove, parseMessage } from '../utils/netProtocol';
import { createInitialState, getOrientations, rotatePiece } from '../utils/gameLogic';
import { piece } from './helpers';

const move = (overrides: Record<string, unknown> = {}) => ({
  t: 'move' as const, turn: 0, pieceId: '5-1', shape: piece('5-1').shape, origin: { x: 0, y: 13 }, clock: 100, ...overrides,
});

describe('parseMessage', () => {
  it('accepts well-formed messages and drops unknown fields', () => {
    expect(parseMessage({ t: 'resign', extra: 1 })).toEqual({ t: 'resign' });
    expect(parseMessage({ t: 'start', timeLimit: null, first: 2 })).toEqual({ t: 'start', timeLimit: null, first: 2 });
    expect(parseMessage(move())).toMatchObject({ t: 'move', pieceId: '5-1' });
  });

  it('rejects malformed messages', () => {
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage('move')).toBeNull();
    expect(parseMessage({ t: 'nope' })).toBeNull();
    expect(parseMessage({ t: 'start', timeLimit: 60, first: 3 })).toBeNull();
    expect(parseMessage({ ...move(), origin: { x: 'a', y: 1 } })).toBeNull();
    expect(parseMessage({ ...move(), shape: [{ x: 0.5, y: 0 }] })).toBeNull();
  });
});

describe('applyRemoteMove', () => {
  const start = createInitialState(300, 1);

  it('applies a legal move from the player to move and syncs their clock', () => {
    const next = applyRemoteMove(start, move(), 1)!;
    expect(next).not.toBeNull();
    expect(next.board[13][0]).toBe(1);
    expect(next.timers[1]).toBe(100);
    expect(next.currentPlayer).toBe(2);
  });

  it('accepts any orientation of the piece', () => {
    const vertical = rotatePiece(piece('5-1').shape);
    expect(getOrientations(piece('5-1').shape)).toHaveLength(2);
    expect(applyRemoteMove(start, move({ shape: vertical, origin: { x: 0, y: 9 } }), 1)).not.toBeNull();
  });

  it('rejects moves out of turn, with the wrong turn number, unknown pieces, wrong shapes or illegal squares', () => {
    expect(applyRemoteMove(start, move(), 2)).toBeNull();
    expect(applyRemoteMove(start, move({ turn: 3 }), 1)).toBeNull();
    expect(applyRemoteMove(start, move({ pieceId: 'Z-9' }), 1)).toBeNull();
    expect(applyRemoteMove(start, move({ shape: piece('5-5').shape }), 1)).toBeNull();
    expect(applyRemoteMove(start, move({ origin: { x: 0, y: 5 } }), 1)).toBeNull();
    expect(applyRemoteMove(start, move({ origin: { x: 12, y: 13 } }), 1)).toBeNull();
  });
});
