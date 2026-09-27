// Local persistence: the game in progress, win/loss records and menu preferences.
// Every access is guarded because storage can be unavailable (private mode, blocked site data).
import { GameState, Player } from '../types';

export type Mode = 'PvP' | 'Easy' | 'Medium' | 'Hard' | 'Online';
export type FirstMove = 'me' | 'them' | 'alternate';

export interface SavedGame {
  mode: Exclude<Mode, 'Online'>;
  state: GameState;
  undo: GameState[];
}

export interface Record3 {
  wins: number;
  losses: number;
  draws: number;
}
// For local 1v1 games, "wins" are Crimson wins and "losses" Cobalt wins
export type Stats = Record<Mode, Record3>;

export interface Prefs {
  mode: Mode;
  timeLimit: number | null;
  firstMove: FirstMove;
  nextAlternate: Player; // who starts the next game when alternating
  showHints: boolean;
  tutorialDone: boolean;
}

const KEYS = { game: 'polybound-game-v1', stats: 'polybound-stats-v1', prefs: 'polybound-prefs-v1' };
const MAX_UNDO = 30;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable; the game still works without it
  }
}

export function loadGame(): SavedGame | null {
  const saved = read<SavedGame>(KEYS.game);
  if (!saved?.state?.board || saved.state.gameOver || !Array.isArray(saved.undo)) return null;
  return saved;
}

export const saveGame = (game: SavedGame | null) =>
  write(KEYS.game, game && { ...game, undo: game.undo.slice(-MAX_UNDO) });

const emptyRecord = (): Record3 => ({ wins: 0, losses: 0, draws: 0 });

export function loadStats(): Stats {
  const saved = read<Partial<Stats>>(KEYS.stats) ?? {};
  const modes: Mode[] = ['PvP', 'Easy', 'Medium', 'Hard', 'Online'];
  return Object.fromEntries(modes.map(m => [m, { ...emptyRecord(), ...saved[m] }])) as Stats;
}

export function recordResult(mode: Mode, result: keyof Record3): Stats {
  const stats = loadStats();
  stats[mode] = { ...stats[mode], [result]: stats[mode][result] + 1 };
  write(KEYS.stats, stats);
  return stats;
}

export const DEFAULT_PREFS: Prefs = {
  mode: 'Medium',
  timeLimit: 360,
  firstMove: 'me',
  nextAlternate: 1,
  showHints: true,
  tutorialDone: false,
};

export const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...read<Partial<Prefs>>(KEYS.prefs) });
export const savePrefs = (prefs: Prefs) => write(KEYS.prefs, prefs);
