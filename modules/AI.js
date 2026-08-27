// modules/AI.js
//
// IA heurística para Tetris, sin dependencias externas.
//
// Usa la función de evaluación de Pierre Dellacherie, la referencia clásica del
// problema: seis rasgos con pesos ajustados a mano que despejan del orden de
// cientos de miles de líneas de media. Sustituye a una heurística previa de
// cuatro rasgos que desbordaba el tablero con demasiada frecuencia.
//
// Puntuación = -4·huecos - pozos acumulados - transiciones de fila
//              - transiciones de columna - altura de caída + celdas erosionadas
//
// El planificador NO guarda una lista de pasos: en cada llamada deduce la
// siguiente acción comparando la pieza actual con su destino. Es la diferencia
// entre funcionar y no funcionar, porque entre dos acciones pueden pasar cosas
// (la gravedad baja o fija la pieza, una animación de borrado descarta la
// acción) que dejarían obsoleto cualquier plan preestablecido.

export const DEFAULT_WEIGHTS = {
  holes: -4,             // celdas vacías tapadas: lo más caro de arreglar
  cumulativeWells: -1,   // suma de profundidades de los pozos
  rowTransitions: -1,    // alternancias lleno/vacío recorriendo cada fila
  columnTransitions: -1, // ídem recorriendo cada columna
  landingHeight: -1,     // a qué altura queda la pieza
  erodedPieceCells: 1,   // líneas despejadas × celdas propias en ellas
};

export const ACTION = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  ROTATE: 3,
  HARD_DROP: 4,
};

/** Rotación horaria, idéntica a la que aplica Game.rotateMatrix. */
export function rotateShape(shape) {
  return shape[0].map((_, index) => shape.map(row => row[index]).reverse());
}

export function sameShape(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((row, i) => row.length === b[i].length &&
    row.every((cell, j) => Boolean(cell) === Boolean(b[i][j])));
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
 * Deja caer la pieza en una columna y describe el resultado.
 * @returns {{grid: Array, cells: Array, y: number}|null}
 */
export function simulateDrop(grid, shape, x) {
  if (!fits(grid, shape, x, 0)) return null;

  let y = 0;
  while (fits(grid, shape, x, y + 1)) y++;

  const result = grid.map(row => [...row]);
  const cells = [];
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] && y + row >= 0) {
        result[y + row][x + col] = 1;
        cells.push([y + row, x + col]);
      }
    }
  }
  return { grid: result, cells, y };
}

/** Celdas vacías con algún bloque por encima en su misma columna. */
export function countHoles(grid) {
  let holes = 0;
  for (let x = 0; x < grid[0].length; x++) {
    let blocked = false;
    for (let y = 0; y < grid.length; y++) {
      if (grid[y][x]) blocked = true;
      else if (blocked) holes++;
    }
  }
  return holes;
}

/**
 * Alternancias lleno/vacío recorriendo cada fila de lado a lado. Las paredes
 * cuentan como llenas: una fila casi completa tiene pocas transiciones.
 */
export function rowTransitions(grid) {
  const width = grid[0].length;
  let total = 0;

  for (const row of grid) {
    let previous = 1; // pared izquierda
    for (let x = 0; x < width; x++) {
      const current = row[x] ? 1 : 0;
      if (current !== previous) total++;
      previous = current;
    }
    if (previous !== 1) total++; // pared derecha
  }
  return total;
}

/**
 * Alternancias recorriendo cada columna de arriba abajo. El suelo cuenta como
 * lleno; el techo, como vacío.
 */
export function columnTransitions(grid) {
  const height = grid.length;
  const width = grid[0].length;
  let total = 0;

  for (let x = 0; x < width; x++) {
    let previous = 0; // techo vacío
    for (let y = 0; y < height; y++) {
      const current = grid[y][x] ? 1 : 0;
      if (current !== previous) total++;
      previous = current;
    }
    if (previous !== 1) total++; // suelo lleno
  }
  return total;
}

/**
 * Pozos acumulados: un pozo es una celda vacía con bloques (o pared) a ambos
 * lados. Cada pozo de profundidad d aporta 1+2+...+d, de modo que los pozos
 * profundos penalizan mucho más que los superficiales.
 */
export function cumulativeWells(grid) {
  const height = grid.length;
  const width = grid[0].length;
  let total = 0;

  for (let x = 0; x < width; x++) {
    let depth = 0;
    for (let y = 0; y < height; y++) {
      const vacia = !grid[y][x];
      const izquierdaLlena = x === 0 || grid[y][x - 1];
      const derechaLlena = x === width - 1 || grid[y][x + 1];

      if (vacia && izquierdaLlena && derechaLlena) {
        depth++;
        total += depth; // acumula 1, 2, 3... conforme el pozo se hace hondo
      } else {
        depth = 0;
      }
    }
  }
  return total;
}

/** Elimina las líneas completas y devuelve el tablero resultante y cuántas eran. */
export function clearCompleteLines(grid) {
  const width = grid[0].length;
  const kept = grid.filter(row => !row.every(cell => cell));
  const cleared = grid.length - kept.length;

  while (kept.length < grid.length) kept.unshift(new Array(width).fill(0));
  return { grid: kept, cleared };
}

/**
 * Puntúa una jugada con los seis rasgos de Dellacherie.
 */
export function evaluatePlacement(drop, weights = DEFAULT_WEIGHTS) {
  const { grid: placed, cells, y } = drop;
  const boardHeight = placed.length;

  // Filas que la jugada completa, y cuántas celdas de la propia pieza caen en
  // ellas: es el rasgo "celdas erosionadas", que premia despejar con la pieza.
  const fullRows = new Set();
  placed.forEach((row, index) => { if (row.every(cell => cell)) fullRows.add(index); });
  const propias = cells.filter(([row]) => fullRows.has(row)).length;
  const erodedPieceCells = fullRows.size * propias;

  const { grid: settled } = clearCompleteLines(placed);

  return (
    weights.holes * countHoles(settled) +
    weights.cumulativeWells * cumulativeWells(settled) +
    weights.rowTransitions * rowTransitions(settled) +
    weights.columnTransitions * columnTransitions(settled) +
    weights.landingHeight * (boardHeight - y) +
    weights.erodedPieceCells * erodedPieceCells
  );
}

/**
 * Evalúa todas las posiciones finales posibles y las devuelve ordenadas de
 * mejor a peor.
 */
export function rankPlacements(grid, shape, weights = DEFAULT_WEIGHTS) {
  const opciones = [];
  let candidate = shape.map(row => [...row]);
  const vistas = new Set();

  for (let rotations = 0; rotations < 4; rotations++) {
    // Las piezas simétricas repiten rotaciones: no las evaluamos dos veces.
    const firma = JSON.stringify(candidate);
    if (!vistas.has(firma)) {
      vistas.add(firma);

      for (let x = 0; x <= grid[0].length - candidate[0].length; x++) {
        const drop = simulateDrop(grid, candidate, x);
        if (!drop) continue;
        opciones.push({
          x,
          rotations,
          shape: candidate.map(row => [...row]),
          score: evaluatePlacement(drop, weights),
        });
      }
    }
    candidate = rotateShape(candidate);
  }

  return opciones.sort((a, b) => b.score - a.score);
}

export function findBestPlacement(grid, shape, weights = DEFAULT_WEIGHTS) {
  const opciones = rankPlacements(grid, shape, weights);
  return opciones.length ? opciones[0] : null;
}

export default class AI {
  /**
   * @param {Object} [options]
   * @param {number} [options.mistakeRate] - Probabilidad (0..1) de no elegir la
   *   mejor jugada. Sirve para graduar la dificultad: una IA perfecta es
   *   invencible y no hace divertido el modo versus.
   * @param {Function} [options.random] - Fuente de azar, inyectable en tests.
   */
  constructor(options = {}) {
    this.weights = options.weights || DEFAULT_WEIGHTS;
    this.mistakeRate = options.mistakeRate || 0;
    this.random = options.random || Math.random;

    this.target = null;
    this.targetPieceId = null;
    this.rotationsTried = 0;
  }

  reset() {
    this.target = null;
    this.targetPieceId = null;
    this.rotationsTried = 0;
  }

  /** Elige destino para la pieza, fallando adrede según la dificultad. */
  chooseTarget(grid, shape) {
    const opciones = rankPlacements(grid, shape, this.weights);
    if (!opciones.length) return null;

    if (this.mistakeRate > 0 && this.random() < this.mistakeRate) {
      // Un fallo no es una jugada absurda, sino una jugada mediocre: se elige
      // entre la mitad peor, que es como falla un jugador humano.
      const desde = Math.floor(opciones.length / 2);
      const indice = desde + Math.floor(this.random() * (opciones.length - desde));
      return opciones[Math.min(indice, opciones.length - 1)];
    }
    return opciones[0];
  }

  /**
   * Devuelve la siguiente acción. No guarda un plan de pasos: deduce cada
   * acción del estado real, de modo que si la gravedad mueve la pieza o una
   * acción se descarta, la IA se corrige sola en la llamada siguiente.
   *
   * @param {Object} gameState - Estado devuelto por Game.getGameState().
   * @returns {number|null}
   */
  predictAction(gameState) {
    const piece = gameState && gameState.currentPiece;
    if (!gameState || !Array.isArray(gameState.board) || !piece || !piece.shape) {
      return null;
    }

    // Pieza nueva => destino nuevo.
    if (this.target === null || this.targetPieceId !== gameState.pieceId) {
      this.target = this.chooseTarget(gameState.board, piece.shape);
      this.targetPieceId = gameState.pieceId;
      this.rotationsTried = 0;
      if (!this.target) return null;
    }

    if (!sameShape(piece.shape, this.target.shape)) {
      // Salvaguarda: si una rotación se bloquea contra la pared, cuatro giros
      // devuelven la forma original, así que soltamos en lugar de girar sin fin.
      if (this.rotationsTried >= 4) return ACTION.HARD_DROP;
      this.rotationsTried++;
      return ACTION.ROTATE;
    }

    if (piece.position.x < this.target.x) return ACTION.RIGHT;
    if (piece.position.x > this.target.x) return ACTION.LEFT;
    return ACTION.HARD_DROP;
  }
}
