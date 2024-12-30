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

  canMove(x, y, shape) {
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] !== 0) {
          const newX = x + sx;
          const newY = y + sy;
          if (
            newX < 0 || // Fuera del tablero a la izquierda
            newX >= this.width || // Fuera del tablero a la derecha
            newY >= this.height || // Fuera del tablero por abajo
            (newY >= 0 && this.grid[newY][newX] !== 0) // Colisión con otra pieza
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
          if (boardY >= 0) this.grid[boardY][boardX] = color;
        }
      }
    }
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
        cell.style.backgroundColor = cellColor === 0 ? '#444' : cellColor; // Actualizar color
      }
    }
  }

  drawPiece(piece) {
    const cells = this.element.children;
    const { x, y, shape, color } = piece;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] !== 0) {
          const index = (y + sy) * this.width + (x + sx);
          if (index >= 0 && index < this.width * this.height) {
            cells[index].style.backgroundColor = color; // Dibujar pieza
          }
        }
      }
    }
  }

  drawGhost(piece, ghostY) {
    const cells = this.element.children;
    const { x, shape } = piece;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] !== 0) {
          const index = (ghostY + sy) * this.width + (x + sx);
          if (index >= 0 && index < this.width * this.height) {
            cells[index].classList.add('ghost'); // Agregar clase de sombra
          }
        }
      }
    }
  }
}
