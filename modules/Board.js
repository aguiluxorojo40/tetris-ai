import DomRenderer, {
  EMPTY_COLOR,
  GARBAGE_COLOR,
  GHOST_COLOR,
} from './renderers/DomRenderer.js';

// Se reexportan para no romper a quien ya los importaba de aquí.
export { EMPTY_COLOR, GARBAGE_COLOR, GHOST_COLOR };

export default class Board {
  /**
   * @param {number} width
   * @param {number} height
   * @param {HTMLElement} element
   * @param {Object} [renderer] - Cómo se dibuja. Por defecto, rejilla de divs;
   *   el modo 3D inyecta aquí el renderizador de WebGL.
   */
  constructor(width, height, element, renderer = null) {
    this.width = width;
    this.height = height;
    this.element = element;
    this.grid = Array.from({ length: height }, () => Array(width).fill(0));

    this.renderer = renderer || new DomRenderer();
    this.renderer.init(element, width, height);
  }

  /** Cambia de renderizador en caliente, conservando el estado del tablero. */
  setRenderer(renderer) {
    if (this.renderer && this.renderer.dispose) this.renderer.dispose();
    this.renderer = renderer;
    this.renderer.init(this.element, this.width, this.height);
  }

  canMove(piece, dx, dy) {
    const { x, y, shape } = piece;

    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const newX = x + col + dx;
          const newY = y + row + dy;

          // Verificar si la nueva posición está fuera de los límites del tablero
          if (
            newX < 0 ||
            newX >= this.width ||
            newY >= this.height ||
            (newY >= 0 && this.grid[newY][newX])
          ) {
            return false;
          }
        }
      }
    }

    return true;
  }

  lockPiece(piece) {
    const { x, y, shape, color } = piece;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] !== 0) {
          const boardY = y + sy;
          const boardX = x + sx;
          // Se guarda el color para que la pieza lo conserve al quedar fijada.
          if (boardY >= 0) this.grid[boardY][boardX] = color || EMPTY_COLOR;
        }
      }
    }
  }

  /** Vacía el tablero (se usa al reiniciar la partida). */
  clear() {
    this.grid = Array.from({ length: this.height }, () => new Array(this.width).fill(0));
  }

  /**
   * Inserta filas de basura por abajo, empujando la pila hacia arriba.
   * Todas comparten la misma columna de hueco ("basura limpia", como en
   * Tetris 99), de modo que una pieza I vertical puede despejarlas de golpe.
   * @returns {boolean} true si la pila se ha salido por arriba.
   */
  addGarbage(count, holeColumns) {
    // Admite una columna suelta o una lista con la de cada fila.
    const huecos = Array.isArray(holeColumns)
      ? holeColumns
      : new Array(count).fill(holeColumns);
    let overflow = false;

    for (let i = 0; i < count; i++) {
      const expulsada = this.grid.shift();
      if (expulsada.some(cell => cell)) overflow = true;

      const fila = new Array(this.width).fill(GARBAGE_COLOR);
      fila[huecos[i]] = 0;
      this.grid.push(fila);
    }
    return overflow;
  }

  /** ¿Está el tablero completamente vacío? (perfect clear) */
  isEmpty() {
    return this.grid.every(row => row.every(cell => !cell));
  }

  getFullLines() {
    const fullLines = [];
    this.grid.forEach((row, index) => {
      if (row.every(cell => cell !== 0)) fullLines.push(index);
    });
    return fullLines;
  }

  clearLines(lines) {
    for (const line of lines) {
      this.grid.splice(line, 1);
      this.grid.unshift(Array(this.width).fill(0));
    }
  }

  draw() {
    this.renderer.drawCells(this.grid);
  }

  drawPiece(piece) {
    this.renderer.drawPiece(piece);
  }

  drawGhost(piece, ghostY) {
    this.renderer.drawGhost(piece, ghostY);
  }
}
