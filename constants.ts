
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
    // The middle two squares can jump over others
    shape: [{ x: 0, y: 0 }, { x: 1, y: 0, bridge: true }, { x: 2, y: 0, bridge: true }, { x: 3, y: 0 }]
  },
  { 
    id: 'B-2', 
    size: 4, 
    // The elbow of this Z-shape acts as a bridge
    shape: [{ x: 0, y: 0 }, { x: 1, y: 0, bridge: true }, { x: 1, y: 1, bridge: true }, { x: 2, y: 1 }]
  }
];

export const PLAYER_COLORS = {
  1: {
    name: 'Crimson',
    primary: '#ef4444',
    light: '#fca5a5',
    dark: '#991b1b',
    glow: 'rgba(239, 68, 68, 0.45)',
    bg: 'bg-red-500',
    text: 'text-red-400',
    border: 'border-red-500',
  },
  2: {
    name: 'Cobalt',
    primary: '#3b82f6',
    light: '#93c5fd',
    dark: '#1e3a8a',
    glow: 'rgba(59, 130, 246, 0.45)',
    bg: 'bg-blue-500',
    text: 'text-blue-400',
    border: 'border-blue-500',
  }
};
