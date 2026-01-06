
import React from 'react';
import { Piece, Player } from '../types';
import { PLAYER_COLORS } from '../constants';

interface PieceTrayProps {
  player: Player;
  pieces: Piece[];
  selectedPieceId: string | null;
  onSelectPiece: (piece: Piece) => void;
  disabled: boolean;
}

const PieceTray: React.FC<PieceTrayProps> = ({ player, pieces, selectedPieceId, onSelectPiece, disabled }) => {
  const colorSet = PLAYER_COLORS[player];

  return (
    <div className={`w-full max-w-[500px] flex flex-col gap-2 p-3 glass-card rounded-2xl transition-all duration-300 ${disabled ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
      <div className="flex justify-between items-center px-1">
        <h3 className={`font-orbitron text-[10px] tracking-[0.2em] uppercase flex items-center gap-2 ${colorSet.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colorSet.bg} animate-pulse`}></span>
          P{player} Inventory
        </h3>
        <span className="text-[9px] text-slate-500 uppercase tracking-widest">{pieces.length} Pieces Left</span>
      </div>
      
      <div className="flex overflow-x-auto gap-3 pb-2 pt-1 px-1 custom-scrollbar snap-x no-scrollbar">
        {pieces.map((piece) => {
          const isSelected = selectedPieceId === piece.id;
          
          return (
            <button
              key={piece.id}
              onClick={() => onSelectPiece(piece)}
              className={`flex-shrink-0 w-16 h-16 relative flex items-center justify-center rounded-xl border transition-all duration-300 snap-center
                ${isSelected 
                  ? `border-white shadow-[0_0_20px_rgba(255,255,255,0.2)] scale-110 z-10 ${colorSet.bg}` 
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30'
                }
              `}
            >
              <div className="grid grid-cols-5 grid-rows-5 gap-[0.5px]">
                {Array.from({ length: 25 }).map((_, i) => {
                  const px = i % 5;
                  const py = Math.floor(i / 5);
                  const partIndex = piece.shape.findIndex(p => p.x === px && p.y === py);
                  const isPart = partIndex !== -1;
                  const isBridge = isPart && piece.bridgeIndices?.includes(partIndex);
                  
                  return (
                    <div 
                      key={i} 
                      className={`w-1.5 h-1.5 rounded-[1px] transition-colors 
                        ${isPart 
                          ? (isBridge 
                              ? (isSelected ? 'bg-white/30 border border-white' : 'bg-transparent border border-white/40') 
                              : (isSelected ? 'bg-white' : colorSet.bg)) 
                          : 'bg-transparent'
                        }`} 
                    />
                  );
                })}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-slate-900 text-[8px] px-1 rounded font-bold border border-white/10">{piece.size}</span>
              {piece.bridgeIndices && (
                <div className="absolute top-1 right-1">
                  <div className="w-1.5 h-1.5 border border-white/50 rounded-full animate-pulse"></div>
                </div>
              )}
            </button>
          );
        })}
        {pieces.length === 0 && (
          <div className="w-full flex items-center justify-center py-4 text-[10px] text-slate-500 uppercase tracking-widest italic">
            No pieces remaining
          </div>
        )}
      </div>
    </div>
  );
};

export default PieceTray;
