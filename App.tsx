import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Player, Piece, Point, GameState } from './types';
import { PLAYER_COLORS, PIECES_TEMPLATE } from './constants';
import {
  rotatePiece, flipPiece, normalizeShape, isValidMove, applyMove, createInitialState, finishGame,
  canPlacePiece, getAnchors, hasPlaced, opponentOf, clampOrigin, originAround, pivotOf,
} from './utils/gameLogic';
import { getAIMove, AIDifficulty } from './utils/aiLogic';
import { sfx, isMuted, setMuted } from './utils/sound';
import Board, { cellFromPoint } from './components/Board';
import PieceTray, { PieceGlyph } from './components/PieceTray';

type Mode = AIDifficulty | 'PvP';

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: 'PvP', label: 'Local 1v1', blurb: 'Pass and play' },
  { id: 'Easy', label: 'Easy', blurb: 'Casual, loose play' },
  { id: 'Medium', label: 'Medium', blurb: 'Greedy and central' },
  { id: 'Hard', label: 'Hard', blurb: 'Blocks and looks ahead' },
];

// On touch screens the finger hides whatever is under it, so a dragged piece is held this far above it
const TOUCH_LIFT = 56;

const TIME_OPTIONS = [
  { label: '3m', val: 180 },
  { label: '6m', val: 360 },
  { label: '10m', val: 600 },
  { label: 'Off', val: null },
];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Icon = {
  rotate: <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />,
  flip: <path fillRule="evenodd" d="M10 2a1 1 0 011 1v14a1 1 0 11-2 0V3a1 1 0 011-1zM7.3 5.3a.75.75 0 01.2.5v8.4a.75.75 0 01-1.3.5L2.4 10.5a.75.75 0 010-1l3.8-4.2a.75.75 0 011.1 0zm5.4 0a.75.75 0 011.1 0l3.8 4.2a.75.75 0 010 1l-3.8 4.2a.75.75 0 01-1.3-.5V5.8a.75.75 0 01.2-.5z" clipRule="evenodd" />,
  undo: <path fillRule="evenodd" d="M7.7 3.3a1 1 0 010 1.4L5.4 7H11a6 6 0 010 12H9a1 1 0 110-2h2a4 4 0 000-8H5.4l2.3 2.3a1 1 0 11-1.4 1.4l-4-4a1 1 0 010-1.4l4-4a1 1 0 011.4 0z" clipRule="evenodd" />,
  hint: <path d="M10 2a6 6 0 00-3.5 10.9V15a1 1 0 001 1h5a1 1 0 001-1v-2.1A6 6 0 0010 2zM8 17.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5 1.5 1.5 0 01-1.5 1.5h-1A1.5 1.5 0 018 17.5z" />,
  check: <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />,
  cancel: <path fillRule="evenodd" d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" clipRule="evenodd" />,
  flag: <path fillRule="evenodd" d="M3 2a1 1 0 011 1v.3l1.3-.4a8 8 0 015.3.2l.2.1a6 6 0 004 .2l1.9-.6A1 1 0 0118 3.7v8a1 1 0 01-.7 1l-2.3.7a8 8 0 01-5.3-.2l-.2-.1a6 6 0 00-4-.2L4 13.4V18a1 1 0 11-2 0V3a1 1 0 011-1z" clipRule="evenodd" />,
};

const Svg: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">{children}</svg>
);

const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in" onClick={onClose}>
    <div className="w-full max-w-lg glass-card p-6 rounded-3xl border border-white/15 max-h-[90vh] overflow-y-auto pop-in" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-orbitron font-bold text-white">HOW TO PLAY</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close rules">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
        <section>
          <h3 className="rule-h">Starting</h3>
          <p>Your first piece must touch your home row: <span className="text-red-400">Crimson</span> starts on the bottom row, <span className="text-blue-400">Cobalt</span> on the top row.</p>
        </section>
        <section>
          <h3 className="rule-h">Placement</h3>
          <p>Every new piece must touch one of your own pieces <b>corner to corner</b>. Your pieces may never share an edge with each other. Diamond markers show where you can connect.</p>
        </section>
        <section className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
          <h3 className="rule-h text-amber-300">Neutral zone (centre 4×4)</h3>
          <p>Inside the glowing zone your own pieces <b>may</b> share edges, so you can pack it tightly. Each square you hold there is worth +1.</p>
        </section>
        <section className="p-3 bg-violet-500/10 border border-violet-500/25 rounded-xl">
          <h3 className="rule-h text-violet-300">Bridge pieces</h3>
          <p>Two pieces have dashed <b>bridge</b> squares. A bridge square can hop over an opponent's square to reach the other side of their wall. It doesn't capture the square; the enemy keeps it.</p>
        </section>
        <section>
          <h3 className="rule-h">Turns & ending</h3>
          <p>If you have no legal move your turn is skipped and your opponent keeps playing. The game ends when neither player can move, when someone resigns, or when a clock runs out.</p>
        </section>
        <section>
          <h3 className="rule-h">Scoring</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>−1</b> for each square left in your hand.</li>
            <li><b>+1</b> for each of your squares in the neutral zone.</li>
            <li><b>+2</b> for each opponent piece you enclose, so that every edge touches a piece or the board edge.</li>
            <li><b>+3</b> bonus for placing all of your pieces.</li>
          </ul>
        </section>
        <section className="text-xs text-slate-400">
          <h3 className="rule-h">Controls</h3>
          <p className="mb-1">Drag a piece onto the board, or pick it and tap a square. Drag it to adjust, tap it to rotate, then press <b>Confirm</b> to lock it in.</p>
          <p><kbd>R</kbd>, right-click or tap: rotate · <kbd>F</kbd>: flip · arrows: nudge · <kbd>Enter</kbd>: confirm · <kbd>Esc</kbd>: cancel · <kbd>U</kbd>: undo · <kbd>H</kbd>: toggle hints</p>
        </section>
      </div>
      <button onClick={onClose} className="w-full mt-8 py-3 bg-white text-slate-950 hover:bg-blue-50 font-orbitron font-bold rounded-xl transition-all">GOT IT</button>
    </div>
  </div>
);

// Decorative logo made of the game's own pieces
const LogoMark: React.FC = () => {
  const pieces = [PIECES_TEMPLATE[13], PIECES_TEMPLATE[16], PIECES_TEMPLATE[9]];
  return (
    <div className="flex items-end justify-center gap-3 mb-2 float-slow">
      <div className="rotate-[-12deg]"><PieceGlyph piece={pieces[0]} player={1} size={54} /></div>
      <div className="-translate-y-2"><PieceGlyph piece={pieces[1]} player={2} size={54} /></div>
      <div className="rotate-[10deg]"><PieceGlyph piece={pieces[2]} player={1} size={54} /></div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'game'>('landing');
  const [showRules, setShowRules] = useState(false);
  const [difficulty, setDifficulty] = useState<Mode>('Medium');
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number | null>(360);
  const [showHints, setShowHints] = useState(true);
  const [muted, setMutedState] = useState(isMuted());

  const [gameState, setGameState] = useState<GameState>(() => createInitialState(null));
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [hoverCell, setHoverCell] = useState<Point | null>(null);
  // Pivot square of a piece set down on the board and awaiting confirmation
  const [placement, setPlacement] = useState<Point | null>(null);
  const [trayDrag, setTrayDrag] = useState<{ piece: Piece; x: number; y: number; overBoard: boolean } | null>(null);
  const boardSvgRef = useRef<SVGSVGElement>(null);
  const suppressTrayClickUntil = useRef(0);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);

  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const vsAI = difficulty !== 'PvP';
  const isAITurn = vsAI && gameState.currentPlayer === 2 && !gameState.gameOver;
  const humanCanAct = view === 'game' && !gameState.gameOver && !isAITurn;
  const currentPieces = gameState.currentPlayer === 1 ? gameState.player1Pieces : gameState.player2Pieces;
  const isFirstMove = !hasPlaced(gameState.placedHistory, gameState.currentPlayer);

  const playerName = (p: Player) => (vsAI ? (p === 1 ? 'You' : `AI · ${difficulty}`) : `Player ${p}`);

  // Centre the piece on the staged square (or the pointer) and keep it inside the board
  const pivot = placement ?? hoverCell;
  const previewOrigin = useMemo<Point | null>(
    () => (selectedPiece && pivot ? originAround(selectedPiece.shape, pivot) : null),
    [selectedPiece, pivot]
  );

  const currentMoveIsValid = !!(selectedPiece && previewOrigin && humanCanAct &&
    isValidMove(selectedPiece.shape, previewOrigin, gameState.currentPlayer, gameState.board, isFirstMove));

  const playable = useMemo(() => {
    if (view !== 'game' || gameState.gameOver) return null;
    return new Set(currentPieces.filter(p => canPlacePiece(gameState.currentPlayer, p, gameState.board, gameState.placedHistory)).map(p => p.id));
  }, [view, gameState.board, gameState.currentPlayer, gameState.gameOver, currentPieces, gameState.placedHistory]);

  const anchors = useMemo(
    () => (showHints && humanCanAct ? getAnchors(gameState.currentPlayer, gameState.board, gameState.placedHistory) : null),
    [showHints, humanCanAct, gameState.currentPlayer, gameState.board, gameState.placedHistory]
  );

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // AI turn handling
  useEffect(() => {
    if (view !== 'game' || !isAITurn) return;
    setIsAIThinking(true);
    const timeout = window.setTimeout(() => {
      const s = stateRef.current;
      const move = getAIMove(2, s.player2Pieces, s.player1Pieces, s.board, s.placedHistory, difficulty as AIDifficulty);
      setGameState(prev => (move ? applyMove(prev, move.piece, move.origin) : finishGame(prev, 'blocked')));
      setIsAIThinking(false);
    }, 650);
    return () => {
      clearTimeout(timeout);
      setIsAIThinking(false);
    };
  }, [view, isAITurn, gameState.turn, difficulty]);

  // Chess-clock countdown for the player to move (the AI's clock doesn't run)
  useEffect(() => {
    if (view !== 'game' || gameState.gameOver || gameState.timeLimit === null || isAIThinking) return;
    const interval = window.setInterval(() => {
      setGameState(prev => {
        if (prev.gameOver) return prev;
        const remaining = prev.timers[prev.currentPlayer] - 1;
        const next = { ...prev, timers: { ...prev.timers, [prev.currentPlayer]: Math.max(0, remaining) } };
        return remaining <= 0 ? finishGame(next, 'timeout', prev.currentPlayer) : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view, gameState.gameOver, gameState.timeLimit, isAIThinking]);

  // Feedback for what just happened: sounds and toasts
  const prevRef = useRef(gameState);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = gameState;
    if (view !== 'game' || prev === gameState) return;
    if (gameState.turn < prev.turn || gameState.placedHistory.length === 0) return; // undo or reset

    if (gameState.lastPlacement && gameState.lastPlacement !== prev.lastPlacement) sfx.place(gameState.lastPlacement.playerId);
    if (gameState.surrounded.length > prev.surrounded.length) {
      const scorer = gameState.lastPlacement?.playerId ?? 1;
      const count = gameState.surrounded.length - prev.surrounded.length;
      sfx.surround();
      showToast(`${playerName(scorer)} enclosed ${count > 1 ? `${count} pieces` : 'a piece'}  +${count * 2}`);
    } else if (gameState.skipped && gameState.turn !== prev.turn) {
      sfx.skip();
      showToast(`${playerName(gameState.skipped)} ${vsAI && gameState.skipped === 1 ? 'have' : 'has'} no moves, so the turn passes`);
    }
    if (gameState.gameOver && !prev.gameOver) {
      sfx.gameOver(vsAI ? gameState.winner === 1 : gameState.winner !== 'Draw');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // A new turn invalidates the current selection
  useEffect(() => {
    setSelectedPiece(null);
    setHoverCell(null);
    setPlacement(null);
    setConfirmResign(false);
  }, [gameState.turn, gameState.currentPlayer]);

  const handleRotate = useCallback(() => {
    if (!selectedPiece || !humanCanAct) return;
    sfx.rotate();
    setSelectedPiece({ ...selectedPiece, shape: normalizeShape(rotatePiece(selectedPiece.shape)) });
  }, [selectedPiece, humanCanAct]);

  const handleFlip = useCallback(() => {
    if (!selectedPiece || !humanCanAct) return;
    sfx.rotate();
    setSelectedPiece({ ...selectedPiece, shape: normalizeShape(flipPiece(selectedPiece.shape)) });
  }, [selectedPiece, humanCanAct]);

  const deselect = useCallback(() => {
    setSelectedPiece(null);
    setPlacement(null);
    setHoverCell(null);
  }, []);

  // Tapping a tray piece picks it up; tapping it again rotates it
  const handleSelect = (piece: Piece) => {
    if (!humanCanAct || performance.now() < suppressTrayClickUntil.current) return;
    if (selectedPiece?.id === piece.id) {
      handleRotate();
      return;
    }
    sfx.select();
    setSelectedPiece({ ...piece, shape: normalizeShape(piece.shape) });
    setPlacement(null);
  };

  // Drag a piece out of the tray and drop it on the board
  const handleTrayPointerDown = (piece: Piece, e: React.PointerEvent) => {
    if (!humanCanAct || e.button !== 0) return;
    const { pointerId, clientX: startX, clientY: startY } = e;
    const lift = e.pointerType === 'mouse' ? 0 : TOUCH_LIFT;
    const dragPiece = selectedPiece?.id === piece.id ? selectedPiece : { ...piece, shape: normalizeShape(piece.shape) };
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
        dragging = true;
        sfx.select();
        setSelectedPiece(dragPiece);
        setHoverCell(null);
      }
      const y = ev.clientY - lift;
      const cell = cellFromPoint(boardSvgRef.current, ev.clientX, y);
      setPlacement(cell);
      setTrayDrag({ piece: dragPiece, x: ev.clientX, y, overBoard: !!cell });
    };
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      if (!dragging) return;
      suppressTrayClickUntil.current = performance.now() + 300;
      setTrayDrag(null);
      // A drop on the board leaves the piece staged there; anywhere else it stays in hand
      if (ev.type === 'pointercancel') setPlacement(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  const confirmPlacement = useCallback(() => {
    if (!selectedPiece || !placement || !previewOrigin || !humanCanAct) return;
    if (!currentMoveIsValid) {
      sfx.invalid();
      return;
    }
    setUndoStack(stack => [...stack, gameState]);
    setGameState(prev => applyMove(prev, selectedPiece, previewOrigin));
    deselect();
  }, [selectedPiece, placement, previewOrigin, humanCanAct, currentMoveIsValid, gameState, deselect]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (!selectedPiece || !previewOrigin || !humanCanAct) return;
    const origin = clampOrigin(selectedPiece.shape, { x: previewOrigin.x + dx, y: previewOrigin.y + dy });
    setPlacement(pivotOf(selectedPiece.shape, origin));
  }, [selectedPiece, previewOrigin, humanCanAct]);

  const handleUndo = useCallback(() => {
    if (!humanCanAct || undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    // Keep clocks running as they are; undo shouldn't refund time
    setGameState(prev => ({ ...snapshot, timers: prev.timers }));
    sfx.rotate();
  }, [humanCanAct, undoStack]);

  const handleResign = () => {
    if (!humanCanAct) return;
    if (!confirmResign) {
      setConfirmResign(true);
      window.setTimeout(() => setConfirmResign(false), 3000);
      return;
    }
    setGameState(prev => finishGame(prev, 'resign', prev.currentPlayer));
    setConfirmResign(false);
  };

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (view !== 'game') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'r') handleRotate();
      else if (key === 'f') handleFlip();
      else if (key === 'escape') {
        if (placement) setPlacement(null);
        else deselect();
      }
      else if (key === 'enter') { e.preventDefault(); confirmPlacement(); }
      else if (key.startsWith('arrow') && selectedPiece) {
        e.preventDefault();
        nudge(key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0, key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0);
      }
      else if (key === 'u' || (key === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); handleUndo(); }
      else if (key === 'h') setShowHints(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, handleRotate, handleFlip, handleUndo, placement, selectedPiece, deselect, confirmPlacement, nudge]);

  const startGame = () => {
    setGameState(createInitialState(selectedTimeLimit));
    setUndoStack([]);
    setSelectedPiece(null);
    setHoverCell(null);
    setPlacement(null);
    setIsAIThinking(false);
    setToast(null);
    setView('game');
  };

  const background = (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-grid" />
      <div className="orb orb-red" />
      <div className="orb orb-blue" />
    </div>
  );

  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        {background}
        <div className="w-full max-w-xl text-center space-y-8 rise-in">
          <div className="space-y-3">
            <LogoMark />
            <h1 className="title-glow text-5xl md:text-7xl font-orbitron font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-red-400 via-white to-blue-400 uppercase">
              POLYBOUND
            </h1>
            <p className="text-slate-400 uppercase tracking-[0.5em] text-xs">Tactical Spatial Conquest</p>
          </div>

          <div className="glass-card p-6 md:p-8 rounded-[2rem] space-y-6 text-left">
            <div className="space-y-3">
              <label className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">Opponent</label>
              <div className="grid grid-cols-2 gap-3">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setDifficulty(m.id)}
                    className={`py-3 px-4 rounded-2xl border transition-all text-left ${
                      difficulty === m.id
                        ? 'bg-white/10 border-white/40 text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]'
                        : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-orbitron text-xs">{m.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{m.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">Time Limit (Per Player)</label>
              <div className="grid grid-cols-4 gap-2">
                {TIME_OPTIONS.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setSelectedTimeLimit(t.val)}
                    className={`py-3 rounded-xl font-orbitron text-xs border transition-all ${
                      selectedTimeLimit === t.val ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-white/[0.03] border-white/5 text-slate-500 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button onClick={startGame} className="start-btn w-full py-4 bg-white text-slate-950 font-orbitron font-bold text-lg rounded-2xl transition-all active:scale-95">START GAME</button>
              <button onClick={() => setShowRules(true)} className="text-xs font-orbitron text-slate-400 hover:text-white uppercase tracking-widest py-2">How to Play</button>
            </div>
          </div>
          <p className="text-slate-600 text-[10px] uppercase tracking-widest">14×14 Grid • 18 Pieces • 2 Bridges • 1 Neutral Zone</p>
        </div>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  const winnerColor = gameState.winner === 1 ? PLAYER_COLORS[1] : gameState.winner === 2 ? PLAYER_COLORS[2] : null;
  const endTitle = gameState.winner === 'Draw'
    ? 'Draw'
    : vsAI ? (gameState.winner === 1 ? 'Victory' : 'Defeat') : `${playerName(gameState.winner as Player)} wins`;
  const endSubtitle = gameState.endReason === 'timeout'
    ? `${playerName(opponentOf(gameState.winner as Player))} ran out of time`
    : gameState.endReason === 'resign'
      ? `${playerName(opponentOf(gameState.winner as Player))} resigned`
      : 'No moves remain';

  const renderScoreCard = (p: Player) => {
    const active = gameState.currentPlayer === p && !gameState.gameOver;
    const colors = PLAYER_COLORS[p];
    const pieces = p === 1 ? gameState.player1Pieces : gameState.player2Pieces;
    const lowTime = gameState.timeLimit !== null && gameState.timers[p] < 30;
    return (
      <div key={`score-${p}`} className={`score-card flex-1 flex items-center gap-3 px-3 py-2 rounded-2xl ${p === 2 ? 'flex-row-reverse text-right' : ''} ${active ? 'active' : 'opacity-60'}`}
        style={{ ['--accent' as string]: colors.glow, ['--accent-solid' as string]: colors.primary }}>
        <div key={gameState.scores[p]} className={`score-pop font-orbitron font-bold text-2xl ${colors.text} min-w-[2.5ch]`}>
          {gameState.scores[p]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-orbitron uppercase tracking-widest text-slate-300 truncate">{playerName(p)}</div>
          <div className={`flex items-center gap-2 text-[10px] text-slate-500 whitespace-nowrap ${p === 2 ? 'justify-end' : ''}`}>
            <span>{pieces.length}<span className="hidden sm:inline"> left</span></span>
            {gameState.timeLimit !== null && (
              <span className={`font-mono ${lowTime ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>{formatTime(gameState.timers[p])}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const statusText = gameState.gameOver
    ? 'Game over'
    : isAITurn
      ? 'AI is thinking…'
      : !selectedPiece
        ? `${playerName(gameState.currentPlayer)}: pick or drag a piece`
        : placement
          ? currentMoveIsValid ? 'Confirm, or drag / tap to adjust' : "Can't go there: drag to adjust"
        : isFirstMove
          ? 'Touch your home row'
          : 'Connect corner to corner';

  const ctrlBtn = 'ctrl-btn flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-25 disabled:pointer-events-none';

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-3 lg:pt-5 overflow-x-hidden pb-16 relative">
      {background}
      <div className="w-full max-w-[560px] flex items-center gap-2 mb-3">
        <button onClick={() => setView('landing')} className="p-2 glass-card rounded-xl text-slate-400 hover:text-white transition-colors" aria-label="Main menu">
          <Svg><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></Svg>
        </button>
        {renderScoreCard(1)}
        <span className="text-slate-600 font-orbitron text-[10px]">VS</span>
        {renderScoreCard(2)}
        <button onClick={toggleMute} className="p-2 glass-card rounded-xl text-slate-400 hover:text-white transition-colors" aria-label={muted ? 'Unmute' : 'Mute'}>
          <Svg>
            {muted
              ? <path fillRule="evenodd" d="M9.4 3.2A1 1 0 0111 4v12a1 1 0 01-1.6.8L5.6 14H3a1 1 0 01-1-1V7a1 1 0 011-1h2.6l3.8-2.8zM13.3 7.3a1 1 0 011.4 0L16 8.6l1.3-1.3a1 1 0 111.4 1.4L17.4 10l1.3 1.3a1 1 0 01-1.4 1.4L16 11.4l-1.3 1.3a1 1 0 01-1.4-1.4l1.3-1.3-1.3-1.3a1 1 0 010-1.4z" clipRule="evenodd" />
              : <path fillRule="evenodd" d="M9.4 3.2A1 1 0 0111 4v12a1 1 0 01-1.6.8L5.6 14H3a1 1 0 01-1-1V7a1 1 0 011-1h2.6l3.8-2.8zM14.7 5.3a1 1 0 011.4 0 6.5 6.5 0 010 9.4 1 1 0 11-1.4-1.4 4.5 4.5 0 000-6.6 1 1 0 010-1.4zm-2.1 2.1a1 1 0 011.4 0 3.5 3.5 0 010 5.2 1 1 0 11-1.4-1.4 1.5 1.5 0 000-2.4 1 1 0 010-1.4z" clipRule="evenodd" />}
          </Svg>
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 w-full rise-in">
        <div className="relative">
          <Board
            board={gameState.board}
            placedHistory={gameState.placedHistory}
            surrounded={gameState.surrounded}
            currentPlayer={gameState.currentPlayer}
            selectedPiece={humanCanAct ? selectedPiece : null}
            previewOrigin={previewOrigin}
            staged={!!placement}
            isValid={currentMoveIsValid}
            lastPlacement={gameState.lastPlacement}
            anchors={anchors}
            interactive={humanCanAct}
            svgRef={boardSvgRef}
            onHover={setHoverCell}
            onStage={setPlacement}
            onRotate={handleRotate}
          />

          {toast && (
            <div key={toast.key} className="toast absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-slate-900/95 border border-white/15 shadow-xl z-30 text-xs font-orbitron tracking-wider text-white whitespace-nowrap">
              {toast.text}
            </div>
          )}

          {isAIThinking && !toast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur rounded-full border border-blue-500/50 shadow-lg flex items-center gap-2 z-30 fade-in">
              <span className="thinking-dot" /><span className="thinking-dot" style={{ animationDelay: '0.15s' }} /><span className="thinking-dot" style={{ animationDelay: '0.3s' }} />
              <span className="text-[10px] font-orbitron text-blue-300 uppercase tracking-widest ml-1">AI Thinking</span>
            </div>
          )}

          {gameState.gameOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md rounded-3xl fade-in">
              <div className="text-center p-6 pop-in w-full max-w-sm">
                <p className="text-[10px] font-orbitron uppercase tracking-[0.4em] text-slate-500 mb-2">{endSubtitle}</p>
                <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-5 uppercase"
                  style={{ color: winnerColor?.primary ?? '#cbd5e1', textShadow: `0 0 30px ${winnerColor?.glow ?? 'transparent'}` }}>
                  {endTitle}
                </h2>
                <table className="w-full text-xs mb-6 glass-card rounded-xl overflow-hidden">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-widest text-slate-500">
                      <th className="text-left p-2 font-normal"></th>
                      <th className="p-2 font-normal text-red-400">{playerName(1)}</th>
                      <th className="p-2 font-normal text-blue-400">{playerName(2)}</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {([
                      ['Neutral zone', 'neutral'],
                      ['Enclosures', 'surround'],
                      ['All placed', 'allPlaced'],
                      ['Unplaced squares', 'unplaced'],
                    ] as const).map(([label, k]) => (
                      <tr key={k} className="border-t border-white/5">
                        <td className="text-left p-2 text-slate-400">{label}</td>
                        <td className="p-2 font-mono">{gameState.breakdown[1][k]}</td>
                        <td className="p-2 font-mono">{gameState.breakdown[2][k]}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-white/15 font-orbitron font-bold">
                      <td className="text-left p-2">Total</td>
                      <td className="p-2 text-red-400">{gameState.scores[1]}</td>
                      <td className="p-2 text-blue-400">{gameState.scores[2]}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex flex-col gap-3">
                  <button onClick={startGame} className="start-btn px-8 py-3 bg-white text-slate-950 font-orbitron font-bold rounded-xl transition-all">REMATCH</button>
                  <button onClick={() => setView('landing')} className="text-slate-400 hover:text-white text-xs uppercase font-bold tracking-widest">Main Menu</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-2 w-full max-w-[560px]">
          <button onClick={handleRotate} disabled={!selectedPiece || !humanCanAct} className={ctrlBtn} title="Rotate (R / right-click / tap the piece)">
            <Svg>{Icon.rotate}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Rotate</span>
          </button>
          <button onClick={handleFlip} disabled={!selectedPiece || !humanCanAct} className={ctrlBtn} title="Flip (F)">
            <Svg>{Icon.flip}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Flip</span>
          </button>
          {selectedPiece && humanCanAct ? (
            <>
              <button onClick={deselect} className={ctrlBtn} title="Put the piece back (Esc)">
                <Svg>{Icon.cancel}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Cancel</span>
              </button>
              <button onClick={confirmPlacement} disabled={!placement || !currentMoveIsValid}
                className={`${ctrlBtn} flex-[2] !border-emerald-400/60 !bg-emerald-500/20 hover:!bg-emerald-500/30 text-emerald-300 ${placement && currentMoveIsValid ? 'confirm-ready' : ''}`}
                title="Confirm placement (Enter)">
                <Svg>{Icon.check}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">{placement ? 'Confirm' : 'Place on board'}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleUndo} disabled={!humanCanAct || undoStack.length === 0} className={ctrlBtn} title="Undo (U)">
                <Svg>{Icon.undo}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Undo</span>
              </button>
              <button onClick={() => setShowHints(v => !v)} className={`${ctrlBtn} ${showHints ? 'text-amber-300' : ''}`} title="Toggle move hints (H)">
                <Svg>{Icon.hint}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Hints {showHints ? 'On' : 'Off'}</span>
              </button>
              <button onClick={handleResign} disabled={!humanCanAct}
                className={`${ctrlBtn} !border-red-500/30 text-red-400 ${confirmResign ? '!bg-red-500/30 animate-pulse' : '!bg-red-500/5 hover:!bg-red-500/10'}`}>
                <Svg>{Icon.flag}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">{confirmResign ? 'Confirm?' : 'Resign'}</span>
              </button>
            </>
          )}
        </div>

        <PieceTray
          player={vsAI ? 1 : gameState.currentPlayer}
          pieces={(vsAI ? gameState.player1Pieces : currentPieces).map(p => (p.id === selectedPiece?.id && humanCanAct ? selectedPiece : p))}
          playable={humanCanAct ? playable : null}
          selectedPieceId={selectedPiece?.id || null}
          onSelectPiece={handleSelect}
          onPiecePointerDown={handleTrayPointerDown}
          disabled={!humanCanAct}
          label={vsAI ? 'Your pieces' : `${playerName(gameState.currentPlayer)} pieces`}
        />

        <button onClick={() => setShowRules(true)} className="text-[9px] uppercase tracking-widest text-slate-500 font-bold hover:text-slate-300 transition-colors py-1">How to Play</button>
      </div>

      <div className="turn-bar fixed bottom-0 left-0 right-0 py-2.5 font-orbitron text-center text-[10px] tracking-[0.3em] uppercase z-40"
        style={{ ['--accent-solid' as string]: gameState.gameOver ? '#334155' : PLAYER_COLORS[gameState.currentPlayer].primary }}>
        {statusText}
      </div>

      {trayDrag && !trayDrag.overBoard && (
        <div className="fixed z-[60] pointer-events-none -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
          style={{ left: trayDrag.x, top: trayDrag.y }}>
          <PieceGlyph piece={trayDrag.piece} player={gameState.currentPlayer} size={72} />
        </div>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
};

export default App;
