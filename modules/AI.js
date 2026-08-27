// modules/AI.js
//
// IA heurística para Tetris, sin dependencias externas.
//
// Sustituye al modelo TensorFlow anterior: para un Tetris de navegador, una
// heurística clásica ocupa unos pocos kilobytes en lugar de más de un megabyte,
// es determinista, se puede testear y juega bien desde el primer momento (el
// modelo anterior, además, nunca llegó a existir: su ruta era un placeholder).
//
// El algoritmo evalúa TODAS las posiciones finales posibles de la pieza actual
// (4 rotaciones × columnas disponibles), simula cómo quedaría el tablero y elige
// la de mejor puntuación. Después genera la secuencia de movimientos necesaria
// para llegar hasta allí.

// Pesos de la heurística. Son los valores clásicos de El-Tetris, ajustados
// mediante algoritmos genéticos, y funcionan muy bien sin más entrenamiento.
export const DEFAULT_WEIGHTS = {
  aggregateHeight: -0.510066, // penaliza tableros altos
  completeLines: 0.760666,    // premia completar líneas
  holes: -0.35663,            // penaliza huecos tapados (muy costosos)
  bumpiness: -0.184483,       // penaliza perfiles irregulares
};

// Espacio de acciones, idéntico al de Game.executeAction.
export const ACTION = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  ROTATE: 3,
  HARD_DROP: 4,
};

/** Altura ocupada de cada columna (0 si la columna está vacía). */
export function columnHeights(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const heights = new Array(width).fill(0);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (grid[y][x]) {
        heights[x] = height - y;
        break;
      }
    }
  }
  return heights;
}

/** Celdas vacías que tienen algún bloque por encima en su misma columna. */
export function countHoles(grid) {
  const height = grid.length;
  const width = grid[0].length;
  let holes = 0;

  for (let x = 0; x < width; x++) {
    let blocked = false;
    for (let y = 0; y < height; y++) {
      if (grid[y][x]) blocked = true;
      else if (blocked) holes++;
    }
  }
  return holes;
}

/** Suma de los desniveles entre columnas contiguas. */
export function bumpiness(heights) {
  let total = 0;
  for (let i = 0; i < heights.length - 1; i++) {
    total += Math.abs(heights[i] - heights[i + 1]);
  }
  return total;
}

/** Elimina las líneas completas y devuelve el tablero resultante y cuántas eran. */
export function clearCompleteLines(grid) {
  const width = grid[0].length;
  const kept = grid.filter(row => !row.every(cell => cell));
  const cleared = grid.length - kept.length;

  while (kept.length < grid.length) {
    kept.unshift(new Array(width).fill(0));
  }
  return { grid: kept, cleared };
}

/** Rotación horaria, idéntica a la que aplica Game.rotateMatrix. */
export function rotateShape(shape) {
  return shape[0].map((_, index) => shape.map(row => row[index]).reverse());
}

/** ¿Cabe la pieza en esa posición sin salirse ni solaparse? */
export function fits(grid, shape, x, y) {
  const height = grid.length;
  const width = grid[0].length;

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const gx = x + col;
      const gy = y + row;
      if (gx < 0 || gx >= width || gy >= height) return false;
      if (gy >= 0 && grid[gy][gx]) return false;
    }
  }
  return true;
}

/**
 * Deja caer la pieza en la columna indicada y devuelve el tablero resultante,
 * o null si la pieza no cabe ahí.
 */
export function dropShape(grid, shape, x) {
  if (!fits(grid, shape, x, 0)) return null;

  let y = 0;
  while (fits(grid, shape, x, y + 1)) y++;

  const result = grid.map(row => [...row]);
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] && y + row >= 0) {
        result[y + row][x + col] = 1;
      }
    }
  }
  return result;
}

/**
 * Puntúa cómo quedaría el tablero tras una jugada. Las líneas completas se
 * eliminan antes de medir altura, huecos y desnivel, para que la valoración
 * refleje el estado real posterior.
 */
export function evaluateGrid(grid, weights = DEFAULT_WEIGHTS) {
  const { grid: settled, cleared } = clearCompleteLines(grid);
  const heights = columnHeights(settled);
  const totalHeight = heights.reduce((sum, h) => sum + h, 0);

  return (
    weights.aggregateHeight * totalHeight +
    weights.completeLines * cleared +
    weights.holes * countHoles(settled) +
    weights.bumpiness * bumpiness(heights)
  );
}

/**
 * Busca la mejor posición final para la pieza, probando cada rotación en cada
 * columna posible.
 * @returns {{rotations: number, x: number, score: number}|null}
 */
export function findBestPlacement(grid, shape, weights = DEFAULT_WEIGHTS) {
  let best = null;
  let candidate = shape.map(row => [...row]);

  for (let rotations = 0; rotations < 4; rotations++) {
    const shapeWidth = candidate[0].length;

    for (let x = 0; x <= grid[0].length - shapeWidth; x++) {
      const result = dropShape(grid, candidate, x);
      if (!result) continue;

      const score = evaluateGrid(result, weights);
      if (!best || score > best.score) {
        best = { rotations, x, score };
      }
    }
    candidate = rotateShape(candidate);
  }
  return best;
}

/** Traduce una posición objetivo en la secuencia de acciones para alcanzarla. */
export function planActions(placement, currentX) {
  const actions = [];

  for (let i = 0; i < placement.rotations; i++) actions.push(ACTION.ROTATE);

  const dx = placement.x - currentX;
  const step = dx < 0 ? ACTION.LEFT : ACTION.RIGHT;
  for (let i = 0; i < Math.abs(dx); i++) actions.push(step);

  actions.push(ACTION.HARD_DROP);
  return actions;
}

export default class AI {
  constructor(weights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.plan = [];
  }

  /** Descarta la jugada en curso (al reiniciar la partida, por ejemplo). */
  reset() {
    this.plan = [];
  }

  /**
   * Devuelve la siguiente acción a ejecutar. Planifica la jugada completa
   * cuando aparece una pieza nueva y luego va entregando sus pasos uno a uno,
   * para no bloquear la interfaz.
   *
   * @param {Object} gameState - Estado devuelto por Game.getGameState().
   * @returns {number|null} - Acción (0-4) o null si no se puede planificar.
   */
  predictAction(gameState) {
    const piece = gameState && gameState.currentPiece;
    if (!gameState || !Array.isArray(gameState.board) || !piece || !piece.shape) {
      return null;
    }

    if (this.plan.length === 0) {
      const placement = findBestPlacement(gameState.board, piece.shape, this.weights);
      if (!placement) return null;
      this.plan = planActions(placement, piece.position.x);
    }

    return this.plan.shift();
  }
}
