
import React, { useState, useEffect, useRef } from 'react';
import { 
  Player, Piece, Point, GameState, PlacedPiece, 
} from './types';
import { 
  PIECES_TEMPLATE, PLAYER_COLORS, BOARD_SIZE
} from './constants';
import { 
  rotatePiece, flipPiece, normalizeShape, isValidMove, calculateScores, checkSurroundings 
} from './utils/gameLogic';
import { getAIMove, canPlayerMove, AIDifficulty } from './utils/aiLogic';
import Board from './components/Board';
import PieceTray from './components/PieceTray';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'game'>('landing');
  const [showRules, setShowRules] = useState(false);
  const [difficulty, setDifficulty] = useState<AIDifficulty | 'PvP'>('Medium');
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number | null>(360); // Default 6 mins
  
  const [gameState, setGameState] = useState<GameState>({
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    currentPlayer: 1,
    scores: { 1: 0, 2: 0 },
    player1Pieces: [...PIECES_TEMPLATE],
    player2Pieces: [...PIECES_TEMPLATE],
    placedHistory: [],
    gameOver: false,
    passCount: 0,
    winner: null,
    lastPlacement: null,
    timeLimit: null,
    timers: { 1: 0, 2: 0 }
  });

  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [hoverOrigin, setHoverOrigin] = useState<Point | null>(null);
  const [surroundedTracker, setSurroundedTracker] = useState<Set<string>>(new Set());
  const [isAIThinking, setIsAIThinking] = useState(false);
  const aiTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Check if current hover is valid
  const currentMoveIsValid = selectedPiece && hoverOrigin ? isValidMove(
    selectedPiece.shape,
    hoverOrigin,
    gameState.currentPlayer,
    gameState.board,
    gameState.placedHistory.filter(p => p.playerId === gameState.currentPlayer).length === 0,
    selectedPiece.bridgeIndices
  ) : false;

  // AI Turn Handling
  useEffect(() => {
    if (view !== 'game' || gameState.gameOver) return;
    if (difficulty !== 'PvP' && gameState.currentPlayer === 2) {
      setIsAIThinking(true);
      aiTimeoutRef.current = window.setTimeout(() => {
        const aiMove = getAIMove(
          2, 
          gameState.player2Pieces, 
          gameState.board, 
          gameState.placedHistory, 
          difficulty as AIDifficulty
        );

        if (aiMove) {
          executePlacement(aiMove.piece, aiMove.origin, 2);
        } else {
          handlePass();
        }
        setIsAIThinking(false);
      }, 800);
    }
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [gameState.currentPlayer, difficulty, gameState.gameOver, view]);

  // Timer Countdown Logic
  useEffect(() => {
    if (view === 'game' && !gameState.gameOver && gameState.timeLimit !== null && !isAIThinking) {
      timerIntervalRef.current = window.setInterval(() => {
        setGameState(prev => {
          const currentTimer = prev.timers[prev.currentPlayer];
          if (currentTimer <= 0) return { ...prev };
          return {
            ...prev,
            timers: { ...prev.timers, [prev.currentPlayer]: currentTimer - 1 }
          };
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [view, gameState.gameOver, gameState.timeLimit, gameState.currentPlayer, isAIThinking]);

  // Check for time exhaustion
  useEffect(() => {
    if (!gameState.gameOver && gameState.timeLimit !== null) {
      if (gameState.timers[1] <= 0 || gameState.timers[2] <= 0) endGame();
    }
  }, [gameState.timers, gameState.gameOver]);

  // Automatic Game End Check
  useEffect(() => {
    if (view !== 'game' || gameState.gameOver || isAIThinking) return;
    const pieces = gameState.currentPlayer === 1 ? gameState.player1Pieces : gameState.player2Pieces;
    if (pieces.length === 0) {
      endGame();
      return;
    }
    const canMove = canPlayerMove(gameState.currentPlayer, pieces, gameState.board, gameState.placedHistory);
    if (!canMove) endGame();
  }, [gameState.currentPlayer, gameState.board, gameState.gameOver, view, isAIThinking]);

  const handleRotate = () => {
    if (!selectedPiece) return;
    setSelectedPiece({
      ...selectedPiece,
      shape: normalizeShape(rotatePiece(selectedPiece.shape))
    });
  };

  const handleFlip = () => {
    if (!selectedPiece) return;
    setSelectedPiece({
      ...selectedPiece,
      shape: normalizeShape(flipPiece(selectedPiece.shape))
    });
  };

  const executePlacement = (piece: Piece, origin: Point, player: Player) => {
    const newBoard = gameState.board.map(row => [...row]);
    const absoluteShape = piece.shape.map(p => ({ x: p.x + origin.x, y: p.y + origin.y }));
    
    absoluteShape.forEach(p => {
      newBoard[p.y][p.x] = player;
    });

    const instanceId = `p${player}-${piece.id}-${Date.now()}`;
    const newPlacedPiece: PlacedPiece = {
      id: piece.id,
      playerId: player,
      origin: { ...origin },
      shape: [...piece.shape],
      instanceId
    };

    const newPlacedHistory = [...gameState.placedHistory, newPlacedPiece];
    const opponentId = player === 1 ? 2 : 1;
    const newlySurrounded = checkSurroundings(newBoard, newPlacedHistory, opponentId);
    
    const updatedSurrounded = new Set<string>(surroundedTracker);
    newlySurrounded.forEach(id => updatedSurrounded.add(id));
    setSurroundedTracker(updatedSurrounded);

    const isP1 = player === 1;
    const newP1Pieces = isP1 ? gameState.player1Pieces.filter(p => p.id !== piece.id) : gameState.player1Pieces;
    const newP2Pieces = !isP1 ? gameState.player2Pieces.filter(p => p.id !== piece.id) : gameState.player2Pieces;

    const nextPlayer = player === 1 ? 2 : 1;

    setGameState(prev => {
      const updatedScores = calculateScores(newBoard, newP1Pieces, newP2Pieces, newPlacedHistory, false, updatedSurrounded);
      return {
        ...prev,
        board: newBoard,
        currentPlayer: nextPlayer,
        player1Pieces: newP1Pieces,
        player2Pieces: newP2Pieces,
        placedHistory: newPlacedHistory,
        scores: updatedScores,
        passCount: 0,
        lastPlacement: newPlacedPiece
      };
    });
  };

  const placePiece = (origin: Point) => {
    if (!selectedPiece || !currentMoveIsValid || isAIThinking || gameState.gameOver) return;
    executePlacement(selectedPiece, origin, gameState.currentPlayer);
    setSelectedPiece(null);
  };

  const handlePass = () => {
    if (isAIThinking || gameState.gameOver) return;
    endGame();
  };

  const endGame = () => {
    setGameState(prev => {
      if (prev.gameOver) return prev;
      const finalScores = calculateScores(
        prev.board, 
        prev.player1Pieces, 
        prev.player2Pieces, 
        prev.placedHistory, 
        true, 
        surroundedTracker
      );
      
      let winner: Player | 'Draw' = 'Draw';
      if (finalScores[1] > finalScores[2]) winner = 1;
      else if (finalScores[2] > finalScores[1]) winner = 2;

      if (prev.timers[1] <= 0) winner = 2;
      else if (prev.timers[2] <= 0) winner = 1;

      return {
        ...prev,
        gameOver: true,
        scores: finalScores,
        winner
      };
    });
  };

  const resetGame = () => {
    setGameState({
      board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
      currentPlayer: 1,
      scores: { 1: 0, 2: 0 },
      player1Pieces: [...PIECES_TEMPLATE],
      player2Pieces: [...PIECES_TEMPLATE],
      placedHistory: [],
      gameOver: false,
      passCount: 0,
      winner: null,
      lastPlacement: null,
      timeLimit: selectedTimeLimit,
      timers: { 1: selectedTimeLimit || 0, 2: selectedTimeLimit || 0 }
    });
    setSelectedPiece(null);
    setSurroundedTracker(new Set());
    setIsAIThinking(false);
  };

  const startGame = () => {
    resetGame();
    setView('game');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const RulesModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-lg glass-card p-6 rounded-3xl border border-white/20 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-orbitron font-bold text-blue-400">GAME RULES</h2>
          <button onClick={() => setShowRules(false)} className="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <section className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <h3 className="font-bold text-purple-400 uppercase text-xs tracking-widest mb-1">NEW: Bridge Pieces</h3>
            <p>You have two special pieces with "Bridge" elements (hollow squares). Bridge squares **CAN overlap opponent pieces**, allowing you to jump over enemy lines to reach new sections!</p>
          </section>
          <section>
            <h3 className="font-bold text-white uppercase text-xs tracking-widest mb-1">Starting</h3>
            <p>Player 1 starts on the bottom row. Player 2 starts on the top row.</p>
          </section>
          <section>
            <h3 className="font-bold text-white uppercase text-xs tracking-widest mb-1">Placement</h3>
            <p>Pieces must touch at least one of your own pieces, but only at **corners**. Edges cannot touch.</p>
          </section>
          <section className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <h3 className="font-bold text-blue-400 uppercase text-xs tracking-widest mb-1">Neutral Zone (Middle 4x4)</h3>
            <p>In the glowing central zone, your pieces **CAN** touch your own pieces at the edges. This allows for tighter building!</p>
          </section>
          <section>
            <h3 className="font-bold text-white uppercase text-xs tracking-widest mb-1">Scoring</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>-1 point for each unplaced square.</li>
              <li>+1 point for each square in the Neutral Zone.</li>
              <li>+2 points for each opponent piece you fully surround.</li>
            </ul>
          </section>
        </div>
        <button onClick={() => setShowRules(false)} className="w-full mt-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-orbitron font-bold rounded-xl transition-all">GOT IT</button>
      </div>
    </div>
  );

  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <div className="w-full max-w-xl text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-orbitron font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-red-500 via-white to-blue-500 uppercase">
              POLYBOUND
            </h1>
            <p className="text-slate-400 uppercase tracking-[0.5em] text-xs">Tactical Spatial Conquest</p>
          </div>

          <div className="glass-card p-6 md:p-8 rounded-[2.5rem] border border-white/10 space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">Select Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {['PvP', 'Easy', 'Medium', 'Hard'].map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff as any)}
                    className={`py-3 rounded-2xl font-orbitron text-xs border transition-all ${
                      difficulty === diff ? 'bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                    }`}
                  >
                    {diff === 'PvP' ? 'Local 1v1' : diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">Time Limit (Per Player)</label>
              <div className="grid grid-cols-4 gap-2">
                {[{ label: '3m', val: 180 }, { label: '6m', val: 360 }, { label: '10m', val: 600 }, { label: 'Off', val: null }].map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setSelectedTimeLimit(t.val)}
                    className={`py-3 rounded-xl font-orbitron text-xs border transition-all ${
                      selectedTimeLimit === t.val ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button onClick={startGame} className="w-full py-4 bg-white text-slate-950 font-orbitron font-bold text-lg rounded-2xl hover:bg-blue-50 transition-all active:scale-95 shadow-xl">START GAME</button>
              <button onClick={() => setShowRules(true)} className="text-xs font-orbitron text-slate-400 hover:text-white uppercase tracking-widest py-2">Rules & Scoring</button>
            </div>
          </div>
          <p className="text-slate-600 text-[10px] uppercase tracking-widest">14x14 Grid • 18 Tactical Pieces • 2 Players</p>
        </div>
        {showRules && <RulesModal />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 lg:p-6 overflow-x-hidden bg-slate-950">
      <div className="w-full max-w-[550px] flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('landing')} className="p-2 glass-card rounded-lg text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="hidden sm:block">
            <h2 className="text-lg font-orbitron font-bold text-white tracking-tighter leading-none uppercase">POLYBOUND</h2>
            <span className="text-[8px] uppercase text-slate-500 tracking-widest">{difficulty} • {gameState.timeLimit ? `${gameState.timeLimit/60}m` : 'UNLIMITED'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex flex-col items-end px-3 py-1.5 rounded-xl glass-card border-b-2 transition-all duration-300 ${gameState.currentPlayer === 1 ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-transparent opacity-60'}`}>
            <span className="text-[14px] font-orbitron font-bold text-red-500">{gameState.scores[1]}</span>
            {gameState.timeLimit && <span className={`text-[9px] font-mono ${gameState.timers[1] < 30 ? 'animate-pulse text-red-400' : 'text-slate-400'}`}>{formatTime(gameState.timers[1])}</span>}
          </div>
          <span className="text-slate-700 font-orbitron text-[10px] mx-1">VS</span>
          <div className={`flex flex-col items-start px-3 py-1.5 rounded-xl glass-card border-b-2 transition-all duration-300 ${gameState.currentPlayer === 2 ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-transparent opacity-60'}`}>
            <span className="text-[14px] font-orbitron font-bold text-blue-500">{gameState.scores[2]}</span>
            {gameState.timeLimit && <span className={`text-[9px] font-mono ${gameState.timers[2] < 30 ? 'animate-pulse text-red-400' : 'text-slate-400'}`}>{formatTime(gameState.timers[2])}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative">
          <Board 
            board={gameState.board}
            currentPlayer={gameState.currentPlayer}
            selectedPiece={selectedPiece}
            onPlace={placePiece}
            hoverOrigin={hoverOrigin}
            setHoverOrigin={setHoverOrigin}
            isValid={currentMoveIsValid}
            lastPlacement={gameState.lastPlacement}
          />
          {isAIThinking && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur rounded-full border border-blue-500/50 shadow-lg flex items-center gap-3 z-30 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
              <span className="text-xs font-orbitron text-blue-400 uppercase tracking-widest">AI Thinking...</span>
            </div>
          )}
          {gameState.gameOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md rounded-2xl border-2 border-white/10">
              <div className="text-center p-8">
                <h2 className="text-4xl font-orbitron font-bold mb-2">GAME OVER</h2>
                <p className={`text-2xl font-orbitron mb-6 uppercase tracking-widest ${gameState.winner === 1 ? 'text-red-500' : gameState.winner === 2 ? 'text-blue-500' : 'text-slate-400'}`}>
                  {gameState.timers[1] <= 0 ? "P1 OUT OF TIME" : gameState.timers[2] <= 0 ? "P2 OUT OF TIME" : (gameState.winner === 'Draw' ? "EQUAL STRENGTH" : `PLAYER ${gameState.winner} WINS`)}
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={resetGame} className="px-8 py-3 bg-white text-slate-950 font-orbitron font-bold rounded-xl hover:bg-blue-50 transition-all shadow-xl">REMATCH</button>
                  <button onClick={() => setView('landing')} className="text-slate-400 text-xs uppercase font-bold tracking-widest">Main Menu</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3 w-full max-w-[500px]">
          <button onClick={handleRotate} disabled={!selectedPiece || isAIThinking || gameState.gameOver} className="flex-1 py-3 rounded-xl glass-card border border-white/10 hover:bg-white/5 disabled:opacity-20 flex flex-col items-center justify-center transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            <span className="text-[8px] font-bold uppercase tracking-wider">Rotate</span>
          </button>
          <button onClick={handleFlip} disabled={!selectedPiece || isAIThinking || gameState.gameOver} className="flex-1 py-3 rounded-xl glass-card border border-white/10 hover:bg-white/5 disabled:opacity-20 flex flex-col items-center justify-center transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
              <path d="M7 5a1 1 0 011 1v8a1 1 0 11-2 0V6a1 1 0 011-1zm6 0a1 1 0 011 1v8a1 1 0 11-2 0V6a1 1 0 011-1z" />
            </svg>
            <span className="text-[8px] font-bold uppercase tracking-wider">Flip</span>
          </button>
          <button onClick={handlePass} disabled={isAIThinking || gameState.gameOver} className="flex-1 py-3 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-400 disabled:opacity-20 flex flex-col items-center justify-center transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <span className="text-[8px] font-bold font-orbitron uppercase tracking-wider">Resign</span>
          </button>
        </div>

        <PieceTray 
          player={gameState.currentPlayer} 
          pieces={gameState.currentPlayer === 1 ? gameState.player1Pieces : gameState.player2Pieces} 
          selectedPieceId={selectedPiece?.id || null}
          onSelectPiece={(p) => !isAIThinking && setSelectedPiece(p)}
          disabled={gameState.gameOver || (difficulty !== 'PvP' && gameState.currentPlayer === 2)}
        />

        <button onClick={() => setShowRules(true)} className="text-[9px] uppercase tracking-widest text-slate-500 font-bold hover:text-slate-300 transition-colors py-2">View Rules</button>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 py-2.5 font-orbitron text-center text-[10px] tracking-[0.3em] z-50 transition-colors duration-300
        ${gameState.currentPlayer === 1 ? 'bg-red-600' : 'bg-blue-600'}`}>
        {isAIThinking ? 'AI OPPONENT IS THINKING...' : `PLAYER ${gameState.currentPlayer}'S TURN`}
      </div>
    </div>
  );
};

export default App;
