import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { Player, Piece, Point, GameState } from './types';
import { BOARD_SIZE, PLAYER_COLORS } from './constants';
import {
  rotatePiece, flipPiece, normalizeShape, isValidMove, applyMove, createInitialState, finishGame,
  canPlacePiece, getAnchors, hasPlaced, opponentOf, clampOrigin, originAround, pivotOf, ownedCells, isPointInNeutralZone,
} from './utils/gameLogic';
import { AIDifficulty } from './utils/aiLogic';
import { requestAIMove } from './utils/aiClient';
import { sfx, isMuted, setMuted } from './utils/sound';
import {
  Mode, Prefs, SavedGame, loadGame, saveGame, loadPrefs, savePrefs, loadStats, recordResult,
} from './utils/storage';
import { LESSONS, lessonState, applyLessonMove } from './utils/lessons';
import { connect, Link, normalizeCode, CODE_LENGTH } from './utils/online';
import { NetMessage, applyRemoteMove } from './utils/netProtocol';
import Board, { BoardEffect, cellFromPoint } from './components/Board';
import PieceTray, { PieceGlyph } from './components/PieceTray';
import RulesModal from './components/RulesModal';
import Landing, { OnlineLobby, modeLabel, recordText } from './components/Landing';

// On touch screens the finger hides whatever is under it, so a dragged piece is held this far above it
const TOUCH_LIFT = 56;
// The AI waits at least this long so its move doesn't appear instantly
const AI_MIN_DELAY = 650;

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Board coordinates as spoken to screen readers: columns A–N from the left, rows 1–14 from Crimson's side
const cellName = (p: Point) => `${String.fromCharCode(65 + p.x)}${BOARD_SIZE - p.y}`;

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
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>{children}</svg>
);

type OnlineState = { status: OnlineLobby['status']; role?: 'host' | 'guest'; code?: string; error?: string };

// A room code in the URL (?join=ABCDE) opens the online lobby with it filled in
function takeJoinCode(): string {
  try {
    const params = new URLSearchParams(location.search);
    const code = normalizeCode(params.get('join') ?? '');
    if (params.has('join')) {
      params.delete('join');
      const rest = params.toString();
      history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`);
    }
    return code.length === CODE_LENGTH ? code : '';
  } catch {
    return '';
  }
}

const App: React.FC = () => {
  const [initialJoinCode] = useState(takeJoinCode);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p = loadPrefs();
    return initialJoinCode ? { ...p, mode: 'Online' } : p;
  });
  const [stats, setStats] = useState(loadStats);
  const [saved, setSaved] = useState<SavedGame | null>(loadGame);
  const [view, setView] = useState<'landing' | 'game'>('landing');
  const [showRules, setShowRules] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  // Settings of the game on screen (the menu selection can differ while a game is paused)
  const [mode, setMode] = useState<Mode>(prefs.mode);
  const [lesson, setLesson] = useState<number | null>(null);
  const [lessonDone, setLessonDone] = useState(false);
  const [online, setOnline] = useState<OnlineState>({ status: 'idle' });
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [rematchAsked, setRematchAsked] = useState(false);
  const linkRef = useRef<Link | null>(null);
  const closeLinkRef = useRef<(() => void) | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => createInitialState(null));
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [hoverCell, setHoverCell] = useState<Point | null>(null);
  // Pivot square of a piece set down on the board and awaiting confirmation
  const [placement, setPlacement] = useState<Point | null>(null);
  const [trayDrag, setTrayDrag] = useState<{ piece: Piece; x: number; y: number; overBoard: boolean } | null>(null);
  const boardSvgRef = useRef<SVGSVGElement>(null);
  // The board takes whatever height is left once the bars and tray are laid out
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(0);
  const suppressTrayClickUntil = useRef(0);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [effects, setEffects] = useState<BoardEffect[]>([]);
  const effectKey = useRef(0);
  const [announcement, setAnnouncement] = useState('');

  const stateRef = useRef(gameState);
  stateRef.current = gameState;
  // Last state the feedback effect has seen; loading a state directly sets this so nothing is replayed
  const prevRef = useRef(gameState);

  const inLesson = lesson !== null;
  const isOnline = !inLesson && mode === 'Online';
  const vsAI = !inLesson && (mode === 'Easy' || mode === 'Medium' || mode === 'Hard');
  // The player at this screen, or null in pass-and-play where both players share it
  const localPlayer: Player | null = inLesson || vsAI ? 1 : isOnline ? (online.role === 'guest' ? 2 : 1) : null;
  const isAITurn = vsAI && gameState.currentPlayer === 2 && !gameState.gameOver;
  const isRemoteTurn = isOnline && gameState.currentPlayer !== localPlayer && !gameState.gameOver;
  const humanCanAct = view === 'game' && !gameState.gameOver && !isAITurn && !isRemoteTurn &&
    !(inLesson && lessonDone) && !(isOnline && online.status !== 'playing');
  const currentPieces = gameState.currentPlayer === 1 ? gameState.player1Pieces : gameState.player2Pieces;
  const isFirstMove = !hasPlaced(gameState.placedHistory, gameState.currentPlayer);

  const playerName = (p: Player) => {
    if (inLesson) return p === 1 ? 'You' : 'Cobalt';
    if (vsAI) return p === 1 ? 'You' : `AI · ${mode}`;
    if (isOnline) return p === localPlayer ? 'You' : 'Opponent';
    return PLAYER_COLORS[p].name;
  };
  const has = (p: Player) => (playerName(p) === 'You' ? 'have' : 'has');

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);
  const showHints = prefs.showHints;
  const toggleHints = useCallback(() => updatePrefs({ showHints: !prefs.showHints }), [prefs.showHints, updatePrefs]);

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
    () => (humanCanAct ? getAnchors(gameState.currentPlayer, gameState.board, gameState.placedHistory) : null),
    [humanCanAct, gameState.currentPlayer, gameState.board, gameState.placedHistory]
  );

  const showToast = useCallback((text: string) => {
    setToast({ text, key: Date.now() });
    setAnnouncement(text);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const resetUi = () => {
    setSelectedPiece(null);
    setHoverCell(null);
    setPlacement(null);
    setIsAIThinking(false);
    setToast(null);
    setEffects([]);
    setConfirmResign(false);
    setRematchAsked(false);
  };

  // Show a state without replaying sounds, toasts or stats for how it was reached
  const loadState = (state: GameState) => {
    prevRef.current = state;
    setGameState(state);
  };

  useLayoutEffect(() => {
    const area = boardAreaRef.current;
    if (view !== 'game' || !area) return;
    const measure = () => {
      const style = getComputedStyle(area);
      const height = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setBoardSize(Math.floor(Math.min(area.clientWidth, height, 560)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [view]);

  // ---- Saving the game in progress ----

  const persistRef = useRef<() => void>(() => {});
  persistRef.current = () => {
    if (view !== 'game' || inLesson || mode === 'Online') return;
    const state = stateRef.current;
    // Nothing worth resuming until a piece is down
    const game = state.gameOver || state.placedHistory.length === 0 ? null : { mode, state, undo: undoStack };
    saveGame(game);
  };
  useEffect(() => {
    persistRef.current();
  }, [view, gameState.turn, gameState.gameOver, undoStack]);
  useEffect(() => {
    // Clocks tick every second, so their latest values are saved when the page is hidden instead
    const save = () => persistRef.current();
    const onVisibility = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  // ---- Online play ----

  const closeLink = useCallback(() => {
    closeLinkRef.current?.();
    closeLinkRef.current = null;
    linkRef.current = null;
  }, []);
  useEffect(() => closeLink, [closeLink]);

  const firstPlayerFromPrefs = (): Player => {
    if (prefs.firstMove === 'me') return 1;
    if (prefs.firstMove === 'them') return 2;
    updatePrefs({ nextAlternate: opponentOf(prefs.nextAlternate) });
    return prefs.nextAlternate;
  };

  const beginOnlineGame = (timeLimit: number | null, first: Player) => {
    setMode('Online');
    setLesson(null);
    resetUi();
    loadState(createInitialState(timeLimit, first));
    setUndoStack([]);
    setOnline(o => ({ ...o, status: 'playing', error: undefined }));
    setView('game');
  };

  // Host only: start a game (or rematch) and tell the guest
  const hostStart = (timeLimit: number | null) => {
    const first = firstPlayerFromPrefs();
    linkRef.current?.send({ t: 'start', timeLimit, first });
    beginOnlineGame(timeLimit, first);
  };

  // Network events arrive outside React, so they go through a ref that always sees the latest render
  const netRef = useRef({
    open: (_link: Link) => {},
    message: (_msg: NetMessage) => {},
    close: () => {},
    error: (_text: string) => {},
  });
  netRef.current = {
    open: link => {
      linkRef.current = link;
    },
    message: msg => {
      const remote = opponentOf(localPlayer ?? 1);
      switch (msg.t) {
        case 'hello':
          // The host starts once it hears from the guest, and answers repeats until the first move
          if (online.role !== 'host') break;
          if (online.status === 'hosting') hostStart(prefs.timeLimit);
          else if (!stateRef.current.placedHistory.length && !stateRef.current.gameOver) {
            linkRef.current?.send({ t: 'start', timeLimit: stateRef.current.timeLimit, first: stateRef.current.currentPlayer });
          }
          break;
        case 'start':
          if (online.role === 'guest') beginOnlineGame(msg.timeLimit, msg.first);
          break;
        case 'move': {
          const next = applyRemoteMove(stateRef.current, msg, remote);
          if (next) setGameState(next);
          else showToast('Received a move that doesn’t fit this board');
          break;
        }
        case 'resign':
          setGameState(prev => finishGame(prev, 'resign', remote));
          break;
        case 'timeout':
          setGameState(prev => finishGame({ ...prev, timers: { ...prev.timers, [remote]: 0 } }, 'timeout', remote));
          break;
        case 'rematch':
          if (online.role === 'host' && stateRef.current.gameOver) {
            showToast('Your opponent wants a rematch');
            hostStart(stateRef.current.timeLimit);
          }
          break;
      }
    },
    close: () => {
      linkRef.current = null;
      if (online.status === 'playing') {
        setOnline(o => ({ ...o, status: 'closed' }));
        if (!stateRef.current.gameOver) sfx.skip();
      } else {
        setOnline({ status: 'idle', error: 'The connection closed.' });
      }
    },
    error: text => {
      if (online.status === 'playing') showToast(text);
      else {
        closeLink();
        setOnline({ status: 'idle', error: text });
      }
    },
  };

  const openLink = (role: 'host' | 'guest', code?: string) => {
    closeLink();
    setOnline({ status: role === 'host' ? 'hosting' : 'joining', role });
    closeLinkRef.current = connect({
      onCode: c => setOnline(o => ({ ...o, code: c })),
      onOpen: link => netRef.current.open(link),
      onMessage: msg => netRef.current.message(msg),
      onClose: () => netRef.current.close(),
      onError: text => netRef.current.error(text),
    }, code);
  };

  const lobby: OnlineLobby = {
    status: online.status,
    code: online.code,
    error: online.error,
    joinCode,
    setJoinCode,
    onHost: () => openLink('host'),
    onJoin: () => openLink('guest', joinCode),
    onCancel: () => {
      closeLink();
      setOnline({ status: 'idle' });
    },
  };

  // ---- Turn handling ----

  // AI turn handling. The search runs in a worker; stale answers (after undo or leaving) are dropped.
  useEffect(() => {
    if (view !== 'game' || !isAITurn) return;
    let cancelled = false;
    let timer = 0;
    const s = stateRef.current;
    const started = performance.now();
    setIsAIThinking(true);
    requestAIMove({
      player: 2, pieces: s.player2Pieces, opponentPieces: s.player1Pieces, board: s.board, history: s.placedHistory,
      difficulty: mode as AIDifficulty,
    }).then(move => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        setGameState(prev => {
          if (prev.turn !== s.turn || prev.gameOver) return prev;
          return move ? applyMove(prev, move.piece, move.origin) : finishGame(prev, 'blocked');
        });
        setIsAIThinking(false);
      }, Math.max(0, AI_MIN_DELAY - (performance.now() - started)));
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsAIThinking(false);
    };
  }, [view, isAITurn, gameState.turn, mode]);

  // Chess-clock countdown for the player to move (the AI's clock doesn't run).
  // Online, each side only ends the game on its own clock; the other side hears about it.
  const clockOwner = isOnline ? localPlayer : null;
  const clockPaused = isAIThinking || lessonDone || (isOnline && online.status !== 'playing');
  useEffect(() => {
    if (view !== 'game' || gameState.gameOver || gameState.timeLimit === null || clockPaused) return;
    const interval = window.setInterval(() => {
      setGameState(prev => {
        if (prev.gameOver) return prev;
        const remaining = prev.timers[prev.currentPlayer] - 1;
        const next = { ...prev, timers: { ...prev.timers, [prev.currentPlayer]: Math.max(0, remaining) } };
        const mayEnd = clockOwner === null || prev.currentPlayer === clockOwner;
        return remaining <= 0 && mayEnd ? finishGame(next, 'timeout', prev.currentPlayer) : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view, gameState.gameOver, gameState.timeLimit, clockPaused, clockOwner]);

  // Feedback for what just happened: sounds, toasts, score effects, stats and announcements
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = gameState;
    if (view !== 'game' || prev === gameState) return;
    if (gameState.turn < prev.turn) return; // undo

    const placed = gameState.lastPlacement;
    const newEffects: BoardEffect[] = [];
    const messages: string[] = [];
    if (placed && placed !== prev.lastPlacement) {
      sfx.place(placed.playerId);
      const cells = ownedCells(placed, gameState.board);
      const gained = gameState.breakdown[placed.playerId].neutral - prev.breakdown[placed.playerId].neutral;
      if (gained > 0) {
        newEffects.push({
          key: ++effectKey.current, kind: 'neutral', text: `+${gained}`, color: '#fbbf24',
          cells: cells.filter(p => isPointInNeutralZone(p.x, p.y)),
        });
      }
      const first = placed.shape.reduce((a, b) => (b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a));
      messages.push(`${PLAYER_COLORS[placed.playerId].name} placed a ${placed.shape.length}-square piece at ${cellName({ x: first.x + placed.origin.x, y: first.y + placed.origin.y })}.`);
    }

    const newlySurrounded = gameState.surrounded.filter(id => !prev.surrounded.includes(id));
    if (newlySurrounded.length > 0) {
      const byScorer: Record<Player, number> = { 1: 0, 2: 0 };
      for (const id of newlySurrounded) {
        const piece = gameState.placedHistory.find(p => p.instanceId === id);
        if (!piece) continue;
        const scorer = opponentOf(piece.playerId);
        byScorer[scorer] += 1;
        newEffects.push({
          key: ++effectKey.current, kind: 'enclose', text: '+2', color: PLAYER_COLORS[scorer].light,
          cells: ownedCells(piece, gameState.board),
        });
      }
      sfx.surround();
      const mover = placed?.playerId ?? 1;
      const pieces = (n: number) => (n > 1 ? `${n} pieces` : 'a piece');
      if (byScorer[mover]) showToast(`${playerName(mover)} enclosed ${pieces(byScorer[mover])}  +${byScorer[mover] * 2}`);
      else showToast(`${playerName(mover)} boxed in ${byScorer[opponentOf(mover)] > 1 ? 'their own pieces' : 'their own piece'}  +${byScorer[opponentOf(mover)] * 2} ${playerName(opponentOf(mover))}`);
    } else if (gameState.skipped && gameState.turn !== prev.turn) {
      sfx.skip();
      showToast(`${playerName(gameState.skipped)} ${has(gameState.skipped)} no moves, so the turn passes`);
    }

    if (newEffects.length) {
      setEffects(list => [...list, ...newEffects]);
      const keys = new Set(newEffects.map(e => e.key));
      window.setTimeout(() => setEffects(list => list.filter(e => !keys.has(e.key))), 1800);
    }
    if (messages.length && !newlySurrounded.length && !gameState.skipped) {
      setAnnouncement(`${messages.join(' ')} Score ${gameState.scores[1]} to ${gameState.scores[2]}.`);
    }

    if (gameState.gameOver && !prev.gameOver && !inLesson) {
      const w = gameState.winner;
      sfx.gameOver(localPlayer ? w === localPlayer : w !== 'Draw');
      const result = w === 'Draw' ? 'draws' : (localPlayer ?? 1) === w ? 'wins' : 'losses';
      setStats(recordResult(mode, result));
      setAnnouncement(`Game over. ${w === 'Draw' ? 'Draw' : `${playerName(w as Player)} ${w === localPlayer ? 'win' : 'wins'}`}, ${gameState.scores[1]} to ${gameState.scores[2]}.`);
      if (isOnline && gameState.endReason === 'timeout' && w !== localPlayer) linkRef.current?.send({ t: 'timeout' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Lessons end as soon as their goal is met
  useEffect(() => {
    if (lesson === null || lessonDone || !LESSONS[lesson].isComplete(gameState)) return;
    setLessonDone(true);
    window.setTimeout(() => sfx.gameOver(true), 350);
    setAnnouncement(`Lesson complete. ${LESSONS[lesson].success}`);
  }, [lesson, lessonDone, gameState]);

  // A new turn invalidates the current selection
  useEffect(() => {
    setSelectedPiece(null);
    setHoverCell(null);
    setPlacement(null);
    setConfirmResign(false);
  }, [gameState.turn, gameState.currentPlayer]);

  // Tell screen reader users where a staged piece is and whether it fits
  useEffect(() => {
    if (placement && selectedPiece && humanCanAct) {
      setAnnouncement(`${cellName(placement)}, ${currentMoveIsValid ? 'can place' : 'blocked'}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement, selectedPiece]);

  // ---- Player actions ----

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
    setAnnouncement(`${piece.size}-square piece selected. Use the arrow keys to move it onto the board.`);
  };

  // Drag a piece out of the tray and drop it on the board
  const handleTrayPointerDown = (piece: Piece, e: React.PointerEvent) => {
    if (!humanCanAct || e.button !== 0) return;
    const { pointerId, clientX: startX, clientY: startY } = e;
    const touch = e.pointerType !== 'mouse';
    const lift = touch ? TOUCH_LIFT : 0;
    const dragPiece = selectedPiece?.id === piece.id ? selectedPiece : { ...piece, shape: normalizeShape(piece.shape) };
    const tray = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-tray-scroll]');
    const startScroll = tray?.scrollLeft ?? 0;
    let dragging = false;
    let scrolling = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (scrolling) {
        if (tray) tray.scrollLeft = startScroll - (ev.clientX - startX);
        return;
      }
      if (!dragging) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) < 8) return;
        // The browser doesn't pan the tray (touch-action: none), so a sideways swipe scrolls it here
        if (touch && Math.abs(dx) > Math.abs(dy) * 1.5) {
          scrolling = true;
          suppressTrayClickUntil.current = performance.now() + 300;
          return;
        }
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
      if (scrolling) suppressTrayClickUntil.current = performance.now() + 300;
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
    if (inLesson) {
      setGameState(prev => applyLessonMove(prev, selectedPiece, previewOrigin));
    } else {
      if (isOnline) {
        linkRef.current?.send({
          t: 'move', turn: gameState.turn, pieceId: selectedPiece.id, shape: selectedPiece.shape, origin: previewOrigin,
          clock: gameState.timers[gameState.currentPlayer],
        });
      } else {
        setUndoStack(stack => [...stack, gameState]);
      }
      setGameState(prev => applyMove(prev, selectedPiece, previewOrigin));
    }
    deselect();
  }, [selectedPiece, placement, previewOrigin, humanCanAct, currentMoveIsValid, gameState, deselect, inLesson, isOnline]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (!selectedPiece || !humanCanAct) return;
    if (!previewOrigin) {
      // Keyboard placement starts where the piece fits as held, else at a connection point or the centre
      const { shape } = selectedPiece;
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const origin = { x, y };
          if (isValidMove(shape, origin, gameState.currentPlayer, gameState.board, isFirstMove)) {
            setPlacement(pivotOf(shape, origin));
            return;
          }
        }
      }
      setPlacement(anchors?.[0] ?? { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) });
      return;
    }
    const origin = clampOrigin(selectedPiece.shape, { x: previewOrigin.x + dx, y: previewOrigin.y + dy });
    setPlacement(pivotOf(selectedPiece.shape, origin));
  }, [selectedPiece, previewOrigin, humanCanAct, anchors, gameState.currentPlayer, gameState.board, isFirstMove]);

  const canUndo = !inLesson && !isOnline && humanCanAct && undoStack.length > 0;
  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    // Keep clocks running as they are; undo shouldn't refund time
    setGameState(prev => ({ ...snapshot, timers: prev.timers }));
    sfx.rotate();
  }, [canUndo, undoStack]);

  const handleResign = () => {
    if (gameState.gameOver || inLesson) return;
    if (!confirmResign) {
      setConfirmResign(true);
      window.setTimeout(() => setConfirmResign(false), 3000);
      return;
    }
    const loser = localPlayer ?? gameState.currentPlayer;
    if (isOnline) linkRef.current?.send({ t: 'resign' });
    setGameState(prev => finishGame(prev, 'resign', loser));
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
      if (e.target instanceof HTMLInputElement || showRules) return;
      const key = e.key.toLowerCase();
      if (key === 'r') handleRotate();
      else if (key === 'f') handleFlip();
      else if (key === 'escape') {
        if (placement) setPlacement(null);
        else deselect();
      }
      // Enter only confirms a staged piece, so it still activates focused buttons otherwise
      else if (key === 'enter' && placement) { e.preventDefault(); confirmPlacement(); }
      else if (key.startsWith('arrow') && selectedPiece) {
        e.preventDefault();
        nudge(key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0, key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0);
      }
      else if (key === 'u' || (key === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); handleUndo(); }
      else if (key === 'h') toggleHints();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, showRules, handleRotate, handleFlip, handleUndo, placement, selectedPiece, deselect, confirmPlacement, nudge, toggleHints]);

  // ---- Starting and leaving games ----

  const startGame = (gameMode: Mode, timeLimit: number | null) => {
    const first = firstPlayerFromPrefs();
    saveGame(null);
    setSaved(null);
    setMode(gameMode);
    setLesson(null);
    resetUi();
    loadState(createInitialState(timeLimit, first));
    setUndoStack([]);
    setView('game');
  };

  const resumeGame = () => {
    if (!saved) return;
    setMode(saved.mode);
    setLesson(null);
    resetUi();
    loadState(saved.state);
    setUndoStack(saved.undo);
    setView('game');
  };

  const startLesson = (index: number) => {
    setLesson(index);
    setLessonDone(false);
    resetUi();
    loadState(lessonState(LESSONS[index]));
    setUndoStack([]);
    setView('game');
  };

  const nextLesson = () => {
    if (lesson === null) return;
    if (lesson + 1 < LESSONS.length) startLesson(lesson + 1);
  };

  const finishTutorial = (play: boolean) => {
    updatePrefs({ tutorialDone: true, ...(play ? { mode: 'Easy' as Mode } : {}) });
    if (play) startGame('Easy', null);
    else goToMenu();
  };

  const goToMenu = () => {
    persistRef.current();
    if (isOnline) {
      closeLink();
      setOnline({ status: 'idle' });
    }
    setLesson(null);
    setLessonDone(false);
    setSaved(loadGame());
    setView('landing');
  };

  const rematch = () => {
    if (!isOnline) {
      startGame(mode, gameState.timeLimit);
    } else if (online.role === 'host') {
      hostStart(gameState.timeLimit);
    } else {
      linkRef.current?.send({ t: 'rematch' });
      setRematchAsked(true);
    }
  };

  const background = (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-grid" />
      <div className="orb orb-red" />
      <div className="orb orb-blue" />
    </div>
  );

  const liveRegion = <div className="sr-only" role="status" aria-live="polite">{announcement}</div>;

  if (view === 'landing') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-4 shorter:py-2 sm:p-6 relative">
        {background}
        <Landing
          prefs={prefs}
          onPrefs={updatePrefs}
          stats={stats}
          saved={saved}
          online={lobby}
          onStart={() => startGame(prefs.mode, prefs.timeLimit)}
          onResume={resumeGame}
          onTutorial={() => startLesson(0)}
          onRules={() => setShowRules(true)}
        />
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {liveRegion}
      </div>
    );
  }

  const winnerColor = gameState.winner === 1 ? PLAYER_COLORS[1] : gameState.winner === 2 ? PLAYER_COLORS[2] : null;
  const endTitle = gameState.winner === 'Draw'
    ? 'Draw'
    : localPlayer ? (gameState.winner === localPlayer ? 'Victory' : 'Defeat') : `${playerName(gameState.winner as Player)} wins`;
  const loserName = gameState.winner && gameState.winner !== 'Draw' ? playerName(opponentOf(gameState.winner)) : '';
  const endSubtitle = gameState.endReason === 'timeout'
    ? `${loserName} ran out of time`
    : gameState.endReason === 'resign'
      ? `${loserName} resigned`
      : 'No moves remain';
  const record = recordText(mode, stats);
  const opponentLeft = isOnline && online.status === 'closed';

  const renderScoreCard = (p: Player) => {
    const active = gameState.currentPlayer === p && !gameState.gameOver;
    const colors = PLAYER_COLORS[p];
    const pieces = p === 1 ? gameState.player1Pieces : gameState.player2Pieces;
    const lowTime = gameState.timeLimit !== null && gameState.timers[p] < 30;
    return (
      <div key={`score-${p}`} className={`score-card flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl ${p === 2 ? 'flex-row-reverse text-right' : ''} ${active ? 'active' : 'opacity-60'}`}
        style={{ ['--accent' as string]: colors.glow, ['--accent-solid' as string]: colors.primary }}
        aria-label={`${playerName(p)}, ${colors.name}: ${gameState.scores[p]} points, ${pieces.length} pieces left${active ? ', to move' : ''}`}>
        <div key={gameState.scores[p]} className={`score-pop font-orbitron font-bold text-xl sm:text-2xl ${colors.text} min-w-[2.5ch]`} aria-hidden>
          {gameState.scores[p]}
        </div>
        <div className="flex-1 min-w-0" aria-hidden>
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
    : inLesson && lessonDone
      ? 'Lesson complete'
      : isAITurn
        ? 'AI is thinking…'
        : isRemoteTurn
          ? opponentLeft ? 'Opponent disconnected' : 'Opponent’s turn'
          : !selectedPiece
            ? `${localPlayer ? 'Your turn' : playerName(gameState.currentPlayer)}: pick or drag a piece`
            : placement
              ? currentMoveIsValid ? 'Confirm, or drag / tap to adjust' : "Can't go there: drag to adjust"
              : isFirstMove
                ? 'Touch your home row'
                : 'Connect corner to corner';

  const ctrlBtn = 'ctrl-btn flex-1 py-2.5 short:py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-25 disabled:pointer-events-none';
  const trayPlayer = localPlayer ?? gameState.currentPlayer;
  const trayPieces = localPlayer ? (localPlayer === 1 ? gameState.player1Pieces : gameState.player2Pieces) : currentPieces;
  const currentLesson = lesson !== null ? LESSONS[lesson] : null;

  return (
    <div className="game-shell flex flex-col items-center px-3 pt-3 lg:pt-5 overflow-hidden relative">
      {background}
      <div className="w-full max-w-[560px] flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button onClick={goToMenu} className="p-1.5 sm:p-2 glass-card rounded-xl text-slate-400 hover:text-white transition-colors shrink-0" aria-label="Main menu">
          <Svg><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></Svg>
        </button>
        {renderScoreCard(1)}
        <span className="hidden sm:inline text-slate-600 font-orbitron text-[10px]" aria-hidden>VS</span>
        {renderScoreCard(2)}
        <button onClick={() => setShowRules(true)} className="p-1.5 sm:p-2 glass-card rounded-xl text-slate-400 hover:text-white transition-colors shrink-0" aria-label="How to play">
          <Svg><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></Svg>
        </button>
        <button onClick={toggleMute} className="p-1.5 sm:p-2 glass-card rounded-xl text-slate-400 hover:text-white transition-colors shrink-0" aria-label={muted ? 'Unmute' : 'Mute'}>
          <Svg>
            {muted
              ? <path fillRule="evenodd" d="M9.4 3.2A1 1 0 0111 4v12a1 1 0 01-1.6.8L5.6 14H3a1 1 0 01-1-1V7a1 1 0 011-1h2.6l3.8-2.8zM13.3 7.3a1 1 0 011.4 0L16 8.6l1.3-1.3a1 1 0 111.4 1.4L17.4 10l1.3 1.3a1 1 0 01-1.4 1.4L16 11.4l-1.3 1.3a1 1 0 01-1.4-1.4l1.3-1.3-1.3-1.3a1 1 0 010-1.4z" clipRule="evenodd" />
              : <path fillRule="evenodd" d="M9.4 3.2A1 1 0 0111 4v12a1 1 0 01-1.6.8L5.6 14H3a1 1 0 01-1-1V7a1 1 0 011-1h2.6l3.8-2.8zM14.7 5.3a1 1 0 011.4 0 6.5 6.5 0 010 9.4 1 1 0 11-1.4-1.4 4.5 4.5 0 000-6.6 1 1 0 010-1.4zm-2.1 2.1a1 1 0 011.4 0 3.5 3.5 0 010 5.2 1 1 0 11-1.4-1.4 1.5 1.5 0 000-2.4 1 1 0 010-1.4z" clipRule="evenodd" />}
          </Svg>
        </button>
      </div>

      {currentLesson && lesson !== null && (
        <div className={`w-full max-w-[560px] mt-2 px-3 py-2.5 rounded-2xl border transition-colors shrink-0 ${lessonDone ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-amber-400/40 bg-amber-500/10'}`}
          aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <h2 className={`font-orbitron text-xs uppercase tracking-widest ${lessonDone ? 'text-emerald-300' : 'text-amber-300'}`}>
              {lessonDone ? 'Nice!' : currentLesson.title}
            </h2>
            <span className="text-[10px] font-orbitron text-slate-500">Lesson {lesson + 1} of {LESSONS.length}</span>
          </div>
          <p className="text-[13px] shorter:text-xs text-slate-200 leading-snug">{lessonDone ? currentLesson.success : currentLesson.goal}</p>
          {lessonDone && (
            <div className="flex gap-2 mt-2">
              {lesson + 1 < LESSONS.length ? (
                <button onClick={nextLesson} className="flex-1 py-2.5 rounded-xl bg-white text-slate-950 font-orbitron font-bold text-xs">NEXT LESSON</button>
              ) : (
                <>
                  <button onClick={() => finishTutorial(true)} className="flex-1 py-2.5 rounded-xl bg-white text-slate-950 font-orbitron font-bold text-xs">PLAY THE EASY AI</button>
                  <button onClick={() => finishTutorial(false)} className="px-4 py-2.5 rounded-xl border border-white/20 text-slate-300 font-orbitron text-xs">MENU</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div ref={boardAreaRef} className="flex-1 min-h-0 w-full flex items-center justify-center py-2 rise-in">
        <div className="relative">
          <Board
            size={boardSize}
            board={gameState.board}
            placedHistory={gameState.placedHistory}
            surrounded={gameState.surrounded}
            currentPlayer={gameState.currentPlayer}
            selectedPiece={humanCanAct ? selectedPiece : null}
            previewOrigin={previewOrigin}
            staged={!!placement}
            isValid={currentMoveIsValid}
            lastPlacement={gameState.lastPlacement}
            anchors={showHints ? anchors : null}
            effects={effects}
            interactive={humanCanAct}
            svgRef={boardSvgRef}
            onHover={setHoverCell}
            onStage={setPlacement}
            onRotate={handleRotate}
          />

          {toast && (
            <div key={toast.key} className="toast absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-slate-900/95 border border-white/15 shadow-xl z-30 text-xs font-orbitron tracking-wider text-white whitespace-nowrap" aria-hidden>
              {toast.text}
            </div>
          )}

          {isAIThinking && !toast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur rounded-full border border-blue-500/50 shadow-lg flex items-center gap-2 z-30 fade-in">
              <span className="thinking-dot" /><span className="thinking-dot" style={{ animationDelay: '0.15s' }} /><span className="thinking-dot" style={{ animationDelay: '0.3s' }} />
              <span className="text-[10px] font-orbitron text-blue-300 uppercase tracking-widest ml-1">AI Thinking</span>
            </div>
          )}

        </div>
      </div>

      <div className="w-full max-w-[560px] flex flex-col gap-2 shrink-0">
        <div className="flex justify-center gap-2 w-full">
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
              {inLesson ? (
                <button onClick={() => lesson !== null && startLesson(lesson)} className={ctrlBtn} title="Start this lesson again">
                  <Svg>{Icon.undo}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Reset</span>
                </button>
              ) : !isOnline && (
                <button onClick={handleUndo} disabled={!canUndo} className={ctrlBtn} title="Undo (U)">
                  <Svg>{Icon.undo}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Undo</span>
                </button>
              )}
              <button onClick={toggleHints} aria-pressed={showHints} className={`${ctrlBtn} ${showHints ? 'text-amber-300' : ''}`} title="Toggle move hints (H)">
                <Svg>{Icon.hint}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">Hints {showHints ? 'On' : 'Off'}</span>
              </button>
              {!inLesson && (
                <button onClick={handleResign} disabled={gameState.gameOver || (!isOnline && !humanCanAct)}
                  className={`${ctrlBtn} !border-red-500/30 text-red-400 ${confirmResign ? '!bg-red-500/30 animate-pulse' : '!bg-red-500/5 hover:!bg-red-500/10'}`}>
                  <Svg>{Icon.flag}</Svg><span className="text-[8px] font-bold uppercase tracking-wider">{confirmResign ? 'Confirm?' : 'Resign'}</span>
                </button>
              )}
            </>
          )}
        </div>

        <PieceTray
          player={trayPlayer}
          pieces={trayPieces.map(p => (p.id === selectedPiece?.id && humanCanAct ? selectedPiece : p))}
          playable={humanCanAct ? playable : null}
          selectedPieceId={selectedPiece?.id || null}
          onSelectPiece={handleSelect}
          onPiecePointerDown={handleTrayPointerDown}
          disabled={!humanCanAct}
          label={localPlayer ? 'Your pieces' : `${playerName(gameState.currentPlayer)} pieces`}
        />
      </div>

      <div className="turn-bar shrink-0 self-stretch -mx-3 mt-2 pt-2.5 shorter:pt-1.5 font-orbitron text-center text-[10px] tracking-[0.3em] uppercase z-40"
        style={{ ['--accent-solid' as string]: gameState.gameOver ? '#334155' : PLAYER_COLORS[gameState.currentPlayer].primary }}>
        {statusText}
      </div>

      {opponentLeft && !gameState.gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-slate-950/80 backdrop-blur-md fade-in">
          <div className="text-center p-6 pop-in" role="alert">
            <h2 className="text-2xl font-orbitron font-bold mb-2 text-slate-200">OPPONENT LEFT</h2>
            <p className="text-sm text-slate-400 mb-6">The connection to your opponent closed.</p>
            <button onClick={goToMenu} className="start-btn px-8 py-3 bg-white text-slate-950 font-orbitron font-bold rounded-xl">MAIN MENU</button>
          </div>
        </div>
      )}

      {gameState.gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-slate-950/80 backdrop-blur-md fade-in">
          <div className="text-center p-6 pop-in w-full max-w-sm">
            <p className="text-[10px] font-orbitron uppercase tracking-[0.4em] text-slate-500 mb-2">{endSubtitle}</p>
            <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-5 uppercase"
              style={{ color: winnerColor?.primary ?? '#cbd5e1', textShadow: `0 0 30px ${winnerColor?.glow ?? 'transparent'}` }}>
              {endTitle}
            </h2>
            <table className="w-full text-xs mb-3 glass-card rounded-xl overflow-hidden">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-slate-500">
                  <th className="text-left p-2 font-normal"><span className="sr-only">Score</span></th>
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
            <p className="text-[10px] text-slate-400 font-mono mb-5 min-h-[1em]">
              {record && `${modeLabel(mode)} · ${record.replace('Your record: ', '')}`}
            </p>
            <div className="flex flex-col gap-3">
              {opponentLeft ? (
                <p className="text-xs text-slate-400">Your opponent has left.</p>
              ) : (
                <button onClick={rematch} disabled={rematchAsked}
                  className="start-btn px-8 py-3 bg-white text-slate-950 font-orbitron font-bold rounded-xl transition-all disabled:opacity-50">
                  {isOnline && online.role === 'guest' ? (rematchAsked ? 'WAITING FOR HOST…' : 'ASK FOR REMATCH') : 'REMATCH'}
                </button>
              )}
              <button onClick={goToMenu} className="text-slate-400 hover:text-white text-xs uppercase font-bold tracking-widest">Main Menu</button>
            </div>
          </div>
        </div>
      )}

      {trayDrag && !trayDrag.overBoard && (
        <div className="fixed z-[60] pointer-events-none -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
          style={{ left: trayDrag.x, top: trayDrag.y }}>
          <PieceGlyph piece={trayDrag.piece} player={trayPlayer} size={72} />
        </div>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {liveRegion}
    </div>
  );
};

export default App;
