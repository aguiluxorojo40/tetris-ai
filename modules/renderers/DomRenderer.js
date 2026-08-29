// modules/renderers/DomRenderer.js
//
// Dibuja el tablero con una rejilla de <div>. Es el renderizador por defecto:
// no necesita nada, arranca al instante y va fino en cualquier móvil.

export const EMPTY_COLOR = '#444';
export const GARBAGE_COLOR = '#8a8a8a';
export const GHOST_COLOR = 'rgba(255, 255, 255, 0.28)';

export default class DomRenderer {
  init(element, width, height) {
    this.element = element;
    this.width = width;
    this.height = height;

    this.element.innerHTML = '';
    this.element.classList.remove('webgl');
    for (let i = 0; i < width * height; i++) {
      this.element.appendChild(document.createElement('div'));
    }
  }

  /** Pinta las celdas fijadas a partir de la grilla. */
  drawCells(grid) {
    const cells = this.element.children;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const valor = grid[y][x];
        const cell = cells[y * this.width + x];
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
    // Color de reserva neutro: el rojo se confundiría con una pieza Z.
    const { x, y, shape, color = GARBAGE_COLOR } = piece;

    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (!shape[sy][sx]) continue;
        const index = (y + sy) * this.width + (x + sx);
        if (index >= 0 && index < this.width * this.height) {
          cells[index].style.backgroundColor = color;
        }
      }
    }
  }

  drawGhost(piece, ghostY) {
    const cells = this.element.children;
    const { x, shape } = piece;

    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (!shape[sy][sx]) continue;
        const index = (ghostY + sy) * this.width + (x + sx);
        if (index >= 0 && index < this.width * this.height) {
          cells[index].style.backgroundColor = GHOST_COLOR;
        }
      }
    }
  }

  dispose() {
    if (this.element) this.element.innerHTML = '';
  }
}
