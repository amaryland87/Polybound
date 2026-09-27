import React, { useMemo, useRef } from 'react';
import { BOARD_SIZE, PLAYER_COLORS, NEUTRAL_ZONE_START, NEUTRAL_ZONE_END } from '../constants';
import { Player, Point, Piece, PlacedPiece } from '../types';
import { Board as BoardGrid, isPointInNeutralZone, ownedCells, clampOrigin, originAround, pivotOf } from '../utils/gameLogic';

// A short-lived highlight with a floating label, e.g. "+2" over an enclosed piece
export interface BoardEffect {
  key: number;
  kind: 'neutral' | 'enclose';
  cells: Point[];
  text: string;
  color: string;
}

interface BoardProps {
  board: BoardGrid;
  placedHistory: PlacedPiece[];
  surrounded: string[];
  currentPlayer: Player;
  selectedPiece: Piece | null;
  previewOrigin: Point | null;
  staged: boolean; // piece is set down and waiting for confirmation
  isValid: boolean;
  lastPlacement: PlacedPiece | null;
  anchors: Point[] | null;
  effects: BoardEffect[];
  interactive: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onHover: (cell: Point | null) => void;
  onStage: (pivot: Point) => void;
  onRotate: () => void;
}

const C = 40;     // cell size in SVG units
const G = 2.5;    // inset from each cell edge
const R = 6;      // corner radius
const SIZE = BOARD_SIZE * C;

const cellKey = (x: number, y: number) => y * BOARD_SIZE + x;

// Squares carry a mark as well as a colour so the players can be told apart without colour vision:
// a dot for Crimson, a ring for Cobalt.
export const PlayerMark: React.FC<{ player: Player; cx: number; cy: number; r: number; color?: string; opacity?: number }> = ({
  player, cx, cy, r, color = 'white', opacity = 0.55,
}) =>
  player === 1
    ? <circle cx={cx} cy={cy} r={r * 0.75} fill={color} opacity={opacity} pointerEvents="none" />
    : <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={r * 0.55} opacity={opacity} pointerEvents="none" />;

// Board square under a screen point. With clamp, points off the board snap to the nearest edge square.
export function cellFromPoint(svg: SVGSVGElement | null, clientX: number, clientY: number, clamp = false): Point | null {
  const rect = svg?.getBoundingClientRect();
  if (!rect) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * BOARD_SIZE);
  const y = Math.floor(((clientY - rect.top) / rect.height) * BOARD_SIZE);
  if (clamp) return { x: Math.max(0, Math.min(BOARD_SIZE - 1, x)), y: Math.max(0, Math.min(BOARD_SIZE - 1, y)) };
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE ? { x, y } : null;
}

const PieceShape: React.FC<{
  piece: PlacedPiece;
  board: BoardGrid;
  isLast: boolean;
  isSurrounded: boolean;
}> = ({ piece, board, isLast, isSurrounded }) => {
  const colors = PLAYER_COLORS[piece.playerId];
  const cells = ownedCells(piece, board);
  const owned = new Set(cells.map(p => cellKey(p.x, p.y)));
  const has = (x: number, y: number) => owned.has(cellKey(x, y));
  const bridgeCells = piece.shape.filter(c => c.bridge).map(c => ({ x: c.x + piece.origin.x, y: c.y + piece.origin.y }));
  const hopped = bridgeCells.filter(p => !has(p.x, p.y));
  const ownedBridges = bridgeCells.filter(p => has(p.x, p.y));

  return (
    <g className={`piece-drop ${isLast ? 'piece-last' : ''}`} style={{ ['--glow' as string]: colors.glow }}>
      <g fill={colors.primary}>
        {cells.map(({ x, y }) => (
          <React.Fragment key={`${x}-${y}`}>
            <rect x={x * C + G} y={y * C + G} width={C - 2 * G} height={C - 2 * G} rx={R} />
            {/* Bridge the gaps between squares of the same piece so it reads as one solid shape */}
            {has(x + 1, y) && <rect x={(x + 1) * C - G - R} y={y * C + G} width={2 * (G + R)} height={C - 2 * G} />}
            {has(x, y + 1) && <rect x={x * C + G} y={(y + 1) * C - G - R} width={C - 2 * G} height={2 * (G + R)} />}
            {has(x + 1, y) && has(x, y + 1) && has(x + 1, y + 1) && (
              <rect x={(x + 1) * C - G - R} y={(y + 1) * C - G - R} width={2 * (G + R)} height={2 * (G + R)} />
            )}
          </React.Fragment>
        ))}
      </g>
      {/* Per-square bevel so individual squares stay readable */}
      {cells.map(({ x, y }) => (
        <g key={`b-${x}-${y}`} pointerEvents="none">
          <rect x={x * C + G + 3} y={y * C + G + 3} width={C - 2 * G - 6} height={C - 2 * G - 6} rx={R - 2}
            fill={`url(#bevel-${piece.playerId})`} />
          <rect x={x * C + G + 5} y={y * C + G + 4} width={C - 2 * G - 16} height={3} rx={1.5} fill="white" opacity={0.35} />
          <PlayerMark player={piece.playerId} cx={x * C + C / 2} cy={y * C + C / 2} r={5} />
        </g>
      ))}
      {ownedBridges.map(({ x, y }) => (
        <rect key={`ob-${x}-${y}`} x={x * C + 11} y={y * C + 11} width={C - 22} height={C - 22} rx={3}
          fill="none" stroke="white" strokeWidth={2} strokeDasharray="3 2.5" opacity={0.8} />
      ))}
      {hopped.map(({ x, y }) => (
        <g key={`h-${x}-${y}`}>
          <rect x={x * C + G + 1} y={y * C + G + 1} width={C - 2 * G - 2} height={C - 2 * G - 2} rx={R}
            fill={colors.primary} fillOpacity={0.3} stroke={colors.light} strokeWidth={2} strokeDasharray="5 3" />
          <path d={`M ${x * C + 8} ${y * C + C - 12} Q ${x * C + C / 2} ${y * C + 6} ${x * C + C - 8} ${y * C + C - 12}`}
            fill="none" stroke={colors.light} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      ))}
      {isSurrounded && cells.map(({ x, y }) => (
        <rect key={`s-${x}-${y}`} className="fade-in" x={x * C + G} y={y * C + G} width={C - 2 * G} height={C - 2 * G} rx={R}
          fill="url(#hatch)" pointerEvents="none" />
      ))}
    </g>
  );
};

const Board: React.FC<BoardProps> = ({
  board,
  placedHistory,
  surrounded,
  currentPlayer,
  selectedPiece,
  previewOrigin,
  staged,
  isValid,
  lastPlacement,
  anchors,
  effects,
  interactive,
  svgRef,
  onHover,
  onStage,
  onRotate,
}) => {
  // Active drag of the piece on the board. `fresh` means this press just set the piece down.
  const dragRef = useRef<{ pointerId: number; startCell: Point; startOrigin: Point; moved: boolean; fresh: boolean } | null>(null);
  const colors = PLAYER_COLORS[currentPlayer];
  const surroundedSet = useMemo(() => new Set(surrounded), [surrounded]);

  const handleDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !interactive || !selectedPiece) return;
    const cell = cellFromPoint(svgRef.current, e.clientX, e.clientY);
    if (!cell) return;
    const onPiece = staged && previewOrigin &&
      selectedPiece.shape.some(c => c.x + previewOrigin.x === cell.x && c.y + previewOrigin.y === cell.y);
    const startOrigin = onPiece ? previewOrigin : originAround(selectedPiece.shape, cell);
    if (!onPiece) onStage(pivotOf(selectedPiece.shape, startOrigin));
    dragRef.current = { pointerId: e.pointerId, startCell: cell, startOrigin, moved: false, fresh: !onPiece };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!interactive || !selectedPiece) return;
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      const cell = cellFromPoint(svgRef.current, e.clientX, e.clientY, true)!;
      const dx = cell.x - drag.startCell.x, dy = cell.y - drag.startCell.y;
      if (!drag.moved && !dx && !dy) return;
      drag.moved = true;
      const origin = clampOrigin(selectedPiece.shape, { x: drag.startOrigin.x + dx, y: drag.startOrigin.y + dy });
      onStage(pivotOf(selectedPiece.shape, origin));
    } else if (e.pointerType === 'mouse' && !staged) {
      const cell = cellFromPoint(svgRef.current, e.clientX, e.clientY);
      if (cell) onHover(cell);
    }
  };

  const handleUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // Tapping the piece without moving it rotates it
    if (!drag.moved && !drag.fresh) onRotate();
  };

  const previewCells = selectedPiece && previewOrigin
    ? selectedPiece.shape.map(c => ({ x: c.x + previewOrigin.x, y: c.y + previewOrigin.y, bridge: c.bridge }))
    : [];

  const ns = NEUTRAL_ZONE_START * C;
  const nsSize = (NEUTRAL_ZONE_END - NEUTRAL_ZONE_START + 1) * C;

  return (
    <div className="board-frame relative p-2 md:p-3 rounded-3xl">
      <svg
        ref={svgRef}
        viewBox={`-4 -4 ${SIZE + 8} ${SIZE + 8}`}
        role="application"
        aria-label={`Game board, ${BOARD_SIZE} by ${BOARD_SIZE}. Pick a piece from your tray, then move it with the arrow keys, rotate with R, flip with F and place it with Enter.`}
        className="block touch-none select-none"
        style={{ width: 'min(92vw, 540px, calc(100vh - 330px))', minWidth: 280, aspectRatio: '1 / 1', cursor: selectedPiece && !staged ? 'crosshair' : 'default' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => { dragRef.current = null; }}
        onPointerLeave={e => e.pointerType === 'mouse' && onHover(null)}
        onContextMenu={e => {
          e.preventDefault();
          if (interactive && selectedPiece) onRotate();
        }}
      >
        <defs>
          {([1, 2] as Player[]).map(p => (
            <linearGradient key={p} id={`bevel-${p}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={PLAYER_COLORS[p].light} stopOpacity={0.55} />
              <stop offset="0.5" stopColor={PLAYER_COLORS[p].primary} stopOpacity={0} />
              <stop offset="1" stopColor={PLAYER_COLORS[p].dark} stopOpacity={0.6} />
            </linearGradient>
          ))}
          <radialGradient id="neutral-fill" cx="0.5" cy="0.5" r="0.7">
            <stop offset="0" stopColor="#fbbf24" stopOpacity={0.22} />
            <stop offset="1" stopColor="#a855f7" stopOpacity={0.06} />
          </radialGradient>
          <linearGradient id="home-1" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={PLAYER_COLORS[1].primary} stopOpacity={0.35} />
            <stop offset="1" stopColor={PLAYER_COLORS[1].primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="home-2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PLAYER_COLORS[2].primary} stopOpacity={0.35} />
            <stop offset="1" stopColor={PLAYER_COLORS[2].primary} stopOpacity={0} />
          </linearGradient>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(2,6,23,0.45)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          </pattern>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Home rows */}
        <rect x={0} y={(BOARD_SIZE - 1) * C} width={SIZE} height={C} fill="url(#home-1)" rx={8} />
        <rect x={0} y={0} width={SIZE} height={C} fill="url(#home-2)" rx={8} />

        {/* Empty squares */}
        {board.map((row, y) =>
          row.map((_, x) => (
            <rect key={`c-${x}-${y}`} x={x * C + G} y={y * C + G} width={C - 2 * G} height={C - 2 * G} rx={R}
              fill={isPointInNeutralZone(x, y) ? 'rgba(251,191,36,0.07)' : 'rgba(148,163,184,0.07)'}
              stroke="rgba(148,163,184,0.06)" />
          ))
        )}

        {/* Neutral zone */}
        <g pointerEvents="none">
          <rect x={ns - 2} y={ns - 2} width={nsSize + 4} height={nsSize + 4} rx={12} fill="none"
            stroke="#fbbf24" strokeWidth={6} opacity={0.35} filter="url(#soft-glow)" className="neutral-pulse" />
          <rect x={ns} y={ns} width={nsSize} height={nsSize} rx={10} fill="url(#neutral-fill)"
            stroke="#fbbf24" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="6 4" />
        </g>

        {/* Pieces */}
        {placedHistory.map(piece => (
          <PieceShape
            key={piece.instanceId}
            piece={piece}
            board={board}
            isLast={lastPlacement?.instanceId === piece.instanceId}
            isSurrounded={surroundedSet.has(piece.instanceId)}
          />
        ))}

        {/* Move hints: squares where a new piece could connect */}
        {anchors && (
          <g pointerEvents="none" className="fade-in">
            {anchors.map(({ x, y }) => (
              <rect key={`a-${x}-${y}`} x={x * C + C / 2 - 4} y={y * C + C / 2 - 4} width={8} height={8}
                transform={`rotate(45 ${x * C + C / 2} ${y * C + C / 2})`}
                fill={colors.primary} opacity={0.55} className="anchor-blink" />
            ))}
          </g>
        )}

        {/* Placement preview */}
        {previewCells.length > 0 && (
          <g pointerEvents={staged ? 'auto' : 'none'} style={{ cursor: staged ? 'grab' : undefined }}>
            {previewCells.map(({ x, y, bridge }, i) => {
              const inside = x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
              if (!inside) return null;
              return (
                <rect key={`p-${i}`} x={x * C + G} y={y * C + G} width={C - 2 * G} height={C - 2 * G} rx={R}
                  fill={isValid ? colors.primary : '#64748b'}
                  fillOpacity={isValid ? (bridge ? 0.35 : staged ? 0.85 : 0.6) : 0.35}
                  stroke={!isValid ? '#f87171' : staged ? 'white' : colors.light}
                  strokeWidth={staged ? 2.5 : 2}
                  strokeDasharray={bridge ? '5 3' : undefined}
                  className={isValid && !staged ? 'preview-valid' : ''} />
              );
            })}
          </g>
        )}

        {/* Score effects */}
        {effects.map(effect => {
          const cx = effect.cells.reduce((acc, p) => acc + p.x, 0) / effect.cells.length;
          const top = Math.min(...effect.cells.map(p => p.y));
          return (
            <g key={effect.key} pointerEvents="none">
              {effect.cells.map(({ x, y }) => (
                <rect key={`${x}-${y}`} className={effect.kind === 'enclose' ? 'enclose-flash' : 'neutral-flash'}
                  x={x * C + 1} y={y * C + 1} width={C - 2} height={C - 2} rx={R + 1}
                  fill="none" stroke={effect.color} strokeWidth={3} />
              ))}
              <text className="float-up" x={cx * C + C / 2} y={Math.max(top * C - 4, 22)} textAnchor="middle"
                fontFamily="Orbitron, sans-serif" fontWeight={700} fontSize={effect.kind === 'enclose' ? 22 : 18}
                fill={effect.color} stroke="#020617" strokeWidth={4} paintOrder="stroke">
                {effect.text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default Board;
