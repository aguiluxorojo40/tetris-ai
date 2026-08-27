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
          if (boardY >= 0) this.grid[boardY][boardX] = 1; // Usar valores numéricos
        }
      }
    }
  }

  /** Vacía el tablero (se usa al reiniciar la partida). */
  clear() {
    this.grid = Array.from({ length: this.height }, () => new Array(this.width).fill(0));
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
        const cellColor = this.grid[y][x];
        const cell = cells[index];
        cell.classList.remove('line-clear', 'ghost'); // Limpiar clases
        cell.style.backgroundColor = cellColor === 0 ? '#444' : 'red'; // Usar un color fijo como 'red'
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
    const ghostColor = 'rgba(255, 0, 0, 0.5)'; // Color semitransparente para la sombra

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
