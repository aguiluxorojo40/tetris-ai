// La grilla guarda 0 en las celdas vacías y el COLOR de la pieza en las
// ocupadas. Antes guardaba un 1, de modo que toda pieza fijada se pintaba de
// rojo y perdía su color en cuanto se posaba.
export const EMPTY_COLOR = '#444';

// La basura del rival se distingue en gris, como en los juegos con color.
export const GARBAGE_COLOR = '#8a8a8a';

// Fantasma neutro: con las piezas ya coloreadas, una sombra roja se confundía
// con una pieza Z.
export const GHOST_COLOR = 'rgba(255, 255, 255, 0.28)';

export default class Board {
  constructor(width, height, element) {
    this.width = width;
    this.height = height;
    this.element = element;
    this.grid = Array.from({ length: height }, () => Array(width).fill(0));
    
    // Crear la representación visual del tablero en el DOM
    this.element.innerHTML = '';
    for (let i = 0; i < width * height; i++) {
      const cell = document.createElement('div');
      this.element.appendChild(cell);
    }
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
    const cells = this.element.children;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        const valor = this.grid[y][x];
        const cell = cells[index];
        cell.classList.remove('line-clear', 'ghost');
        // La grilla guarda un color; se admite cualquier otro valor "lleno"
        // por si alguien la rellena a mano.
        cell.style.backgroundColor = !valor
          ? EMPTY_COLOR
          : (typeof valor === 'string' ? valor : GARBAGE_COLOR);
      }
    }
  }

  drawPiece(piece) {
    const cells = this.element.children;
    const { x, y, shape, color = 'red' } = piece; // Establece un color predeterminado
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] !== 0) {
          const index = (y + sy) * this.width + (x + sx);
          if (index >= 0 && index < this.width * this.height) {
            cells[index].style.backgroundColor = color; // Establece el color
          }
        }
      }
    }
  }

  drawGhost(piece, ghostY) {
    const cells = this.element.children;
    const { x, shape } = piece;
    const ghostColor = GHOST_COLOR;

    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] !== 0) {
          const index = (ghostY + sy) * this.width + (x + sx);
          if (index >= 0 && index < this.width * this.height) {
            cells[index].style.backgroundColor = ghostColor; // Aplicar el color de sombra
          }
        }
      }
    }
  }
}
