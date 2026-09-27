import { describe, expect, it } from 'vitest';
import { getAIMove } from '../utils/aiLogic';
import { createInitialState, isValidMove, hasPlaced } from '../utils/gameLogic';
import { AIDifficulty } from '../utils/aiLogic';

describe.each(['Easy', 'Medium', 'Hard'] as AIDifficulty[])('%s AI', difficulty => {
  it('always returns a legal move', () => {
    const s = createInitialState(null, 2);
    const move = getAIMove(2, s.player2Pieces, s.player1Pieces, s.board, s.placedHistory, difficulty)!;
    expect(move).not.toBeNull();
    expect(isValidMove(move.piece.shape, move.origin, 2, s.board, !hasPlaced(s.placedHistory, 2))).toBe(true);
  });

  it('returns null when it has nothing to play', () => {
    const s = createInitialState(null);
    expect(getAIMove(2, [], s.player1Pieces, s.board, s.placedHistory, difficulty)).toBeNull();
  });
});
