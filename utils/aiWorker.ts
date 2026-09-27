// Runs the AI search off the main thread so animations and input stay smooth while it thinks.
import { getAIMove } from './aiLogic';
import type { AIRequest } from './aiClient';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; req: AIRequest }>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = e => {
  const { id, req } = e.data;
  const move = getAIMove(req.player, req.pieces, req.opponentPieces, req.board, req.history, req.difficulty);
  scope.postMessage({ id, move });
};
