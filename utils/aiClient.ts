import { Player, Piece, PlacedPiece } from '../types';
import { Board, Move } from './gameLogic';
import { getAIMove, AIDifficulty } from './aiLogic';

export interface AIRequest {
  player: Player;
  pieces: Piece[];
  opponentPieces: Piece[];
  board: Board;
  history: PlacedPiece[];
  difficulty: AIDifficulty;
}

const runHere = (req: AIRequest) =>
  getAIMove(req.player, req.pieces, req.opponentPieces, req.board, req.history, req.difficulty);

let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, { req: AIRequest; resolve: (move: Move | null) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; move: Move | null }>) => {
      pending.get(e.data.id)?.resolve(e.data.move);
      pending.delete(e.data.id);
    };
    worker.onerror = () => {
      // Fall back to the main thread for anything in flight and from now on
      worker?.terminate();
      worker = null;
      for (const [id, { req, resolve }] of pending) {
        pending.delete(id);
        resolve(runHere(req));
      }
    };
  } catch {
    worker = null;
  }
  return worker;
}

export function requestAIMove(req: AIRequest): Promise<Move | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(runHere(req));
  return new Promise(resolve => {
    const id = ++nextId;
    pending.set(id, { req, resolve });
    w.postMessage({ id, req });
  });
}
