export const CELL_SIZE = 20;
export const GRID_W = 48;
export const GRID_H = 30;
export const WORLD_W = GRID_W * CELL_SIZE; // 960
export const WORLD_H = GRID_H * CELL_SIZE; // 600

export const CELL = { WALL: 0, ROOM: 1, CORRIDOR: 2, DOOR: 3, EXIT: 4, OBSTACLE: 5, OUTDOOR: 6 };
export const STATUS = { SAFE: 'SAFE', EVACUATING: 'EVACUATING', AT_RISK: 'AT_RISK', TRAPPED: 'TRAPPED', EVACUATED: 'EVACUATED' };
export const CELL_STATE = { SAFE: 'SAFE', SMOKE: 'SMOKE', FIRE: 'FIRE', BLOCKED: 'BLOCKED' };

export const STATUS_COLOR = {
  SAFE: '#7dd3a8', EVACUATING: '#22d3ee', AT_RISK: '#fbbf24', TRAPPED: '#fb4b6a', EVACUATED: '#34d399'
};

export const TOOLS = [
  { id: 'select', label: 'SELECT', hint: 'Click a person to inspect their transform matrix and route' },
  { id: 'fire', label: 'ADD FIRE', hint: 'Click or drag to ignite cells' },
  { id: 'extinguish', label: 'CLEAR FIRE', hint: 'Suppress fire in a 3×3 area (uses a suppression charge)' },
  { id: 'block', label: 'BLOCK', hint: 'Click or drag to block corridor cells with debris' },
  { id: 'unblock', label: 'UNBLOCK', hint: 'Click or drag to clear debris' },
  { id: 'openExit', label: 'OPEN EXIT', hint: 'Click near an exit to open it' },
  { id: 'closeExit', label: 'CLOSE EXIT', hint: 'Click near an exit to close it' },
  { id: 'pan', label: 'PAN', hint: 'Drag to pan the map (mouse wheel zooms)' }
];
