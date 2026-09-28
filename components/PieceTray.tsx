import React from 'react';
import { Piece, Player } from '../types';
import { PLAYER_COLORS } from '../constants';
import { PlayerMark } from './Board';

interface PieceTrayProps {
  player: Player;
  pieces: Piece[];
  playable: Set<string> | null; // ids of pieces that fit somewhere; null while unknown
  selectedPieceId: string | null;
  onSelectPiece: (piece: Piece) => void;
  onPiecePointerDown: (piece: Piece, e: React.PointerEvent) => void; // starts a drag onto the board
  disabled: boolean;
  label: string;
}

export const PieceGlyph: React.FC<{ piece: Piece; player: Player; size?: number; highlight?: boolean }> = ({
  piece, player, size = 44, highlight = false,
}) => {
  const colors = PLAYER_COLORS[player];
  const w = Math.max(...piece.shape.map(p => p.x)) + 1;
  const h = Math.max(...piece.shape.map(p => p.y)) + 1;
  const span = Math.max(w, h, 3);
  const unit = 10;
  const offX = ((span - w) * unit) / 2;
  const offY = ((span - h) * unit) / 2;
  return (
    <svg viewBox={`0 0 ${span * unit} ${span * unit}`} width={size} height={size} aria-hidden>
      {piece.shape.map((c, i) => (
        <React.Fragment key={i}>
          <rect x={offX + c.x * unit + 0.6} y={offY + c.y * unit + 0.6} width={unit - 1.2} height={unit - 1.2} rx={2}
            fill={c.bridge ? 'none' : highlight ? 'white' : colors.primary}
            stroke={c.bridge ? (highlight ? 'white' : colors.light) : 'rgba(255,255,255,0.25)'}
            strokeWidth={c.bridge ? 1.4 : 0.6}
            strokeDasharray={c.bridge ? '2 1.4' : undefined} />
          {!c.bridge && (
            <PlayerMark player={player} cx={offX + c.x * unit + unit / 2} cy={offY + c.y * unit + unit / 2} r={1.6}
              color={highlight ? colors.dark : 'white'} opacity={0.6} />
          )}
        </React.Fragment>
      ))}
    </svg>
  );
};

const PieceTray: React.FC<PieceTrayProps> = ({ player, pieces, playable, selectedPieceId, onSelectPiece, onPiecePointerDown, disabled, label }) => {
  const colors = PLAYER_COLORS[player];
  const squaresLeft = pieces.reduce((acc, p) => acc + p.size, 0);

  return (
    <div className={`tray w-full flex flex-col gap-1 px-2.5 pt-2 pb-1 rounded-2xl transition-all duration-300 ${disabled ? 'opacity-40 pointer-events-none saturate-50' : ''}`}
      style={{ ['--accent' as string]: colors.glow }}>
      <div className="flex justify-between items-center px-1 shorter:hidden">
        <h3 className={`font-orbitron text-[10px] tracking-[0.2em] uppercase flex items-center gap-2 ${colors.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.bg} ${disabled ? '' : 'animate-pulse'}`}></span>
          {label}
        </h3>
        <span className="text-[9px] text-slate-500 uppercase tracking-widest">
          {pieces.length} pieces • {squaresLeft} squares
        </span>
      </div>

      <div data-tray-scroll className="flex overflow-x-auto gap-2.5 pb-2.5 pt-1.5 px-1 custom-scrollbar snap-x">
        {pieces.map((piece) => {
          const isSelected = selectedPieceId === piece.id;
          const fits = playable ? playable.has(piece.id) : true;
          const isBridge = piece.shape.some(c => c.bridge);
          return (
            <button
              key={piece.id}
              aria-label={`${piece.size}-square ${isBridge ? 'bridge ' : ''}piece${fits ? '' : ', no legal placement'}`}
              aria-pressed={isSelected}
              onClick={() => onSelectPiece(piece)}
              onPointerDown={e => onPiecePointerDown(piece, e)}
              // Touch drags are handled in script: sideways swipes scroll the tray, anything else pulls the piece out
              style={{ touchAction: 'none' }}
              title={fits ? `${isBridge ? 'Bridge piece: dashed squares can hop over enemy squares' : `${piece.size}-square piece`}. Drag onto the board, tap again to rotate` : 'No legal placement right now'}
              className={`piece-btn select-none flex-shrink-0 w-[56px] h-[56px] shorter:w-12 shorter:h-12 relative flex items-center justify-center rounded-xl border snap-center
                ${isSelected
                  ? `${colors.bg} border-white/80 selected`
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/10 hover:border-white/30'}
                ${fits ? '' : 'opacity-30'}`}
            >
              <PieceGlyph piece={piece} player={player} highlight={isSelected} />
              <span className="absolute -bottom-1.5 -right-1.5 bg-slate-900 text-[9px] min-w-[16px] px-1 rounded-md font-bold border border-white/15 text-slate-300">{piece.size}</span>
              {isBridge && (
                <span className="absolute -top-1.5 -left-1.5 bg-violet-500/90 text-[7px] px-1 rounded font-bold tracking-wider text-white">BRIDGE</span>
              )}
            </button>
          );
        })}
        {pieces.length === 0 && (
          <div className="w-full flex items-center justify-center py-4 text-[10px] text-slate-500 uppercase tracking-widest italic">
            All pieces placed
          </div>
        )}
      </div>
    </div>
  );
};

export default PieceTray;
