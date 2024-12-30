import { Piece } from './Piece.js';

const pieces = [
  // I
  { shape: [[1, 1, 1, 1]], color: 'cyan' },
  
  // O
  { shape: [[1, 1],
            [1, 1]], color: 'yellow' },
  
  // T
  { shape: [[0, 1, 0],
            [1, 1, 1]], color: 'purple' },
  
  // S
  { shape: [[0, 1, 1],
            [1, 1, 0]], color: 'green' },
  
  // Z
  { shape: [[1, 1, 0],
            [0, 1, 1]], color: 'red' },
  
  // L
  { shape: [[1, 0, 0],
            [1, 1, 1]], color: 'blue' },
  
  // J
  { shape: [[0, 0, 1],
            [1, 1, 1]], color: 'orange' },
];

export function getRandomPiece() {
  const randomIndex = Math.floor(Math.random() * pieces.length);
  const { shape, color } = pieces[randomIndex];
  return new Piece(shape, color);
}

export function animateLineClear(boardElement, lines, callback) {
  const cells = boardElement.children;

  // Añade la clase line-clear a las celdas de las líneas a borrar
  lines.forEach((lineIndex) => {
    for (let x = 0; x < 10; x++) {
      const idx = lineIndex * 10 + x;
      cells[idx].classList.add('line-clear');
    }
  });

  setTimeout(() => {
    callback();
  }, 600);
}
