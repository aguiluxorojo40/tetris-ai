import { Piece } from './Piece.js';

const pieces = [
  { type: 'I', shape: [[1, 1, 1, 1]], color: 'cyan' },

  { type: 'O', shape: [[1, 1],
                       [1, 1]], color: 'yellow' },

  { type: 'T', shape: [[0, 1, 0],
                       [1, 1, 1]], color: 'purple' },

  { type: 'S', shape: [[0, 1, 1],
                       [1, 1, 0]], color: 'green' },

  { type: 'Z', shape: [[1, 1, 0],
                       [0, 1, 1]], color: 'red' },

  { type: 'L', shape: [[1, 0, 0],
                       [1, 1, 1]], color: 'blue' },

  { type: 'J', shape: [[0, 0, 1],
                       [1, 1, 1]], color: 'orange' },
];

export function getRandomPiece() {
  const randomIndex = Math.floor(Math.random() * pieces.length);
  const { shape, color, type } = pieces[randomIndex];
  // Clonamos la forma para que cada pieza tenga su propia matriz (rotaciones
  // independientes) y no se mute la definición compartida.
  return new Piece(shape.map(row => [...row]), color, type);
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
