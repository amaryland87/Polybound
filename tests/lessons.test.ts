import { describe, expect, it } from 'vitest';
import { LESSONS, applyLessonMove, lessonState } from '../utils/lessons';
import { findAllValidMoves } from '../utils/gameLogic';

describe.each(LESSONS.map((lesson, i) => [i + 1, lesson] as const))('lesson %i', (_n, lesson) => {
  const state = lessonState(lesson);

  it('starts unsolved, with no pieces already enclosed', () => {
    expect(lesson.isComplete(state)).toBe(false);
    expect(state.surrounded).toEqual([]);
    expect(state.currentPlayer).toBe(1);
  });

  it('can be solved in one move', () => {
    const moves = findAllValidMoves(1, state.player1Pieces, state.board, state.placedHistory);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.some(m => lesson.isComplete(applyLessonMove(state, m.piece, m.origin)))).toBe(true);
  });

  it('keeps the turn with Crimson after a move', () => {
    const [move] = findAllValidMoves(1, state.player1Pieces, state.board, state.placedHistory);
    const next = applyLessonMove(state, move.piece, move.origin);
    expect(next.currentPlayer).toBe(1);
    expect(next.gameOver).toBe(false);
  });
});
