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
  // Asegúrate de que `callback` es una función
  if (typeof callback !== 'function') {
    throw new TypeError('Callback must be a function');
  }

  // Agregar una clase de animación si es necesario
  lines.forEach((lineIndex) => {
    const line = boardElement.children[lineIndex];
    if (line) {
      line.classList.add('animating');
    }
  });

  // Lógica para eliminar la clase 'line-clear' después de la animación
  setTimeout(() => {
    lines.forEach((lineIndex) => {
      const line = boardElement.children[lineIndex];
      if (line) {
        line.classList.remove('line-clear', 'animating');
      }
    });
    callback();
  }, 600); // Duración de la animación en ms
}
