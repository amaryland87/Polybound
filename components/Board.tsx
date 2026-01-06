
import React from 'react';
import { BOARD_SIZE, PLAYER_COLORS, NEUTRAL_ZONE_START, NEUTRAL_ZONE_END } from '../constants';
import { Player, Point, Piece, PlacedPiece } from '../types';
import { isPointInNeutralZone } from '../utils/gameLogic';

interface BoardProps {
  board: (number | null)[][];
  currentPlayer: Player;
  selectedPiece: Piece | null;
  onPlace: (origin: Point) => void;
  hoverOrigin: Point | null;
  setHoverOrigin: (p: Point | null) => void;
  isValid: boolean;
  lastPlacement: PlacedPiece | null;
}

const Board: React.FC<BoardProps> = ({ 
  board, 
  currentPlayer, 
  selectedPiece, 
  onPlace, 
  hoverOrigin, 
  setHoverOrigin,
  isValid,
  lastPlacement
}) => {
  const currentColors = PLAYER_COLORS[currentPlayer];

  const handleInteraction = (x: number, y: number) => {
    setHoverOrigin({ x, y });
  };

  return (
    <div className="relative p-1.5 md:p-3 glass-card rounded-2xl shadow-2xl border border-white/10 overflow-hidden bg-slate-950/40">
      <div 
        className="grid gap-[2px] md:gap-1"
        style={{ 
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
          width: 'min(90vw, 500px)',
          aspectRatio: '1/1'
        }}
        onMouseLeave={() => setHoverOrigin(null)}
      >
        {board.map((row, y) => 
          row.map((cell, x) => {
            const isNeutral = isPointInNeutralZone(x, y);
            const isP1Start = y === BOARD_SIZE - 1;
            const isP2Start = y === 0;
            
            let isPreview = false;
            if (selectedPiece && hoverOrigin) {
              isPreview = selectedPiece.shape.some(p => p.x + hoverOrigin.x === x && p.y + hoverOrigin.y === y);
            }

            const isLastPlacement = lastPlacement?.shape.some(p => p.x + lastPlacement.origin.x === x && p.y + lastPlacement.origin.y === y);

            return (
              <div
                key={`${x}-${y}`}
                onMouseEnter={() => handleInteraction(x, y)}
                onTouchStart={() => handleInteraction(x, y)}
                onClick={() => onPlace({ x, y })}
                className={`
                  relative aspect-square flex items-center justify-center rounded-[2px] md:rounded-sm transition-all duration-150 cursor-crosshair
                  ${cell === null ? (isNeutral ? 'bg-white/10' : 'bg-white/5') : PLAYER_COLORS[cell as Player].bg}
                  ${isPreview ? (isValid ? 'bg-green-500/60 ring-2 ring-green-400 scale-95 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/40 ring-1 ring-red-400 opacity-80') : ''}
                  ${isLastPlacement ? 'ring-[3px] ring-white/60 ring-inset z-10' : ''}
                `}
              >
                {/* Visual Hint for Empty Cells */}
                {cell === null && !isPreview && (
                   <div className={`w-[2px] h-[2px] md:w-1 md:h-1 rounded-full ${isNeutral ? 'bg-white/20' : 'bg-white/5'}`} />
                )}

                {/* Starting Edge Markers - more subtle */}
                {cell === null && !isPreview && isP1Start && (
                  <div className="absolute bottom-0 w-full h-[3px] bg-red-500/30 rounded-full" />
                )}
                {cell === null && !isPreview && isP2Start && (
                  <div className="absolute top-0 w-full h-[3px] bg-blue-500/30 rounded-full" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Aesthetic Overlays */}
      <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-2xl"></div>
    </div>
  );
};

export default Board;
