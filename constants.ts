
import { Piece } from './types';

export const BOARD_SIZE = 14;
export const NEUTRAL_ZONE_START = 5;
export const NEUTRAL_ZONE_END = 8; // 5, 6, 7, 8 inclusive (4x4)

export const PIECES_TEMPLATE: Piece[] = [
  // Size 1
  { id: '1-1', size: 1, shape: [{ x: 0, y: 0 }] },
  // Size 2
  { id: '2-1', size: 2, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  // Size 3
  { id: '3-1', size: 3, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
  { id: '3-2', size: 3, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
  // Size 4
  { id: '4-1', size: 4, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
  { id: '4-2', size: 4, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }] },
  { id: '4-3', size: 4, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
  { id: '4-4', size: 4, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { id: '4-5', size: 4, shape: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }] },
  // Size 5
  { id: '5-1', size: 5, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }] },
  { id: '5-2', size: 5, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }] },
  { id: '5-3', size: 5, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }] },
  { id: '5-4', size: 5, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }] },
  { id: '5-5', size: 5, shape: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 2, y: 1 }] },
  // Mirrored Asymmetric Shapes
  { id: 'A-1', size: 5, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 }] },
  { id: 'A-2', size: 5, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }] },
  
  // SPECIAL BRIDGE PIECES
  { 
    id: 'B-1', 
    size: 4, 
    shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
    bridgeIndices: [1, 2] // The middle two squares can jump over others
  },
  { 
    id: 'B-2', 
    size: 4, 
    shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    bridgeIndices: [1, 2] // The elbow of this Z-shape acts as a bridge
  }
];

export const PLAYER_COLORS = {
  1: {
    primary: '#ef4444',
    glow: '0 0 15px #ef4444',
    bg: 'bg-red-500',
    text: 'text-red-500',
    hover: 'hover:bg-red-400',
    light: 'bg-red-500/20'
  },
  2: {
    primary: '#3b82f6',
    glow: '0 0 15px #3b82f6',
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    hover: 'hover:bg-blue-400',
    light: 'bg-blue-500/20'
  }
};
