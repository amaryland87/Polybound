// Messages exchanged between two browsers in an online game. Both sides run the same rules engine
// and apply each other's moves, so a move is only accepted when it is legal on the local board too.
import { Cell, GameState, Player, Point } from '../types';
import { applyMove, getOrientations, hasPlaced, isValidMove, normalizeShape, shapeKey } from './gameLogic';

export const PROTOCOL_VERSION = 1;

export type NetMessage =
  | { t: 'hello'; v: number }
  | { t: 'start'; timeLimit: number | null; first: Player }
  | { t: 'move'; turn: number; pieceId: string; shape: Cell[]; origin: Point; clock: number }
  | { t: 'resign' }
  | { t: 'timeout' }
  | { t: 'rematch' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isPlayer = (v: unknown): v is Player => v === 1 || v === 2;
const isPoint = (v: unknown): v is Point => isObj(v) && Number.isInteger(v.x) && Number.isInteger(v.y);

export function parseMessage(data: unknown): NetMessage | null {
  if (!isObj(data)) return null;
  switch (data.t) {
    case 'hello':
      return typeof data.v === 'number' ? { t: 'hello', v: data.v } : null;
    case 'start':
      return isPlayer(data.first) && (data.timeLimit === null || typeof data.timeLimit === 'number')
        ? { t: 'start', first: data.first, timeLimit: data.timeLimit }
        : null;
    case 'move':
      if (typeof data.turn !== 'number' || typeof data.pieceId !== 'string' || typeof data.clock !== 'number') return null;
      if (!isPoint(data.origin) || !Array.isArray(data.shape) || !data.shape.every(isPoint)) return null;
      return {
        t: 'move', turn: data.turn, pieceId: data.pieceId, clock: data.clock,
        origin: { x: data.origin.x, y: data.origin.y },
        shape: (data.shape as Cell[]).map(c => ({ x: c.x, y: c.y, ...(c.bridge ? { bridge: true } : {}) })),
      };
    case 'resign':
    case 'timeout':
    case 'rematch':
      return { t: data.t };
    default:
      return null;
  }
}

// Returns the new state, or null if the move doesn't fit the local game (out of turn, unknown piece, illegal).
export function applyRemoteMove(state: GameState, msg: Extract<NetMessage, { t: 'move' }>, remote: Player): GameState | null {
  if (state.gameOver || state.currentPlayer !== remote || msg.turn !== state.turn) return null;
  const hand = remote === 1 ? state.player1Pieces : state.player2Pieces;
  const piece = hand.find(p => p.id === msg.pieceId);
  if (!piece || msg.shape.length !== piece.shape.length) return null;
  const wanted = shapeKey(normalizeShape(msg.shape));
  const shape = getOrientations(piece.shape).find(o => shapeKey(o) === wanted);
  if (!shape || !isValidMove(shape, msg.origin, remote, state.board, !hasPlaced(state.placedHistory, remote))) return null;
  const next = applyMove(state, { ...piece, shape }, msg.origin);
  if (state.timeLimit === null) return next;
  return { ...next, timers: { ...next.timers, [remote]: Math.max(0, Math.min(msg.clock, state.timeLimit)) } };
}
