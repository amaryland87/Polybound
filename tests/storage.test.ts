// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadGame, loadPrefs, loadStats, recordResult, saveGame, savePrefs } from '../utils/storage';
import { applyMove, createInitialState } from '../utils/gameLogic';
import { piece } from './helpers';

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('round-trips a game in progress', () => {
    const state = applyMove(createInitialState(360), piece('5-1'), { x: 0, y: 13 });
    saveGame({ mode: 'Hard', state, undo: [createInitialState(360)] });
    const saved = loadGame()!;
    expect(saved.mode).toBe('Hard');
    expect(saved.state).toEqual(state);
    expect(saved.undo).toHaveLength(1);
  });

  it('does not offer finished or corrupt games', () => {
    const over = { ...createInitialState(null), gameOver: true };
    saveGame({ mode: 'Easy', state: over, undo: [] });
    expect(loadGame()).toBeNull();
    localStorage.setItem('polybound-game-v1', '{not json');
    expect(loadGame()).toBeNull();
    saveGame(null);
    expect(localStorage.getItem('polybound-game-v1')).toBeNull();
  });

  it('caps the saved undo history', () => {
    const undo = Array.from({ length: 50 }, () => createInitialState(null));
    saveGame({ mode: 'Easy', state: applyMove(createInitialState(null), piece('1-1'), { x: 0, y: 13 }), undo });
    expect(loadGame()!.undo).toHaveLength(30);
  });

  it('keeps a record per mode', () => {
    expect(loadStats().Hard).toEqual({ wins: 0, losses: 0, draws: 0 });
    recordResult('Hard', 'wins');
    recordResult('Hard', 'wins');
    recordResult('Online', 'draws');
    const stats = loadStats();
    expect(stats.Hard.wins).toBe(2);
    expect(stats.Online.draws).toBe(1);
    expect(stats.Easy.wins).toBe(0);
  });

  it('merges saved preferences over the defaults', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    savePrefs({ ...DEFAULT_PREFS, mode: 'PvP', timeLimit: null });
    expect(loadPrefs()).toMatchObject({ mode: 'PvP', timeLimit: null, firstMove: 'me' });
  });
});
