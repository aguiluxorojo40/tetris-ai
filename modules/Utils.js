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

// Clonamos la forma para que cada pieza tenga su propia matriz (rotaciones
// independientes) y no se mute la definición compartida.
function buildPiece(index) {
  const { shape, color, type } = pieces[index];
  return new Piece(shape.map(row => [...row]), color, type);
}

export function getRandomPiece() {
  return buildPiece(Math.floor(Math.random() * pieces.length));
}

/**
 * Generador pseudoaleatorio determinista (mulberry32): la misma semilla produce
 * siempre la misma secuencia. Math.random no sirve aquí porque no se puede
 * sembrar, y en el modo versus ambos jugadores deben recibir idénticas piezas.
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Secuencia compartida de piezas. Devuelve una función pieceAt(posición): la
 * secuencia se va calculando bajo demanda y se memoriza, de modo que dos
 * jugadores que la consulten reciban exactamente las mismas piezas.
 */
export function createPieceSequence(seed) {
  const random = createRandom(seed);
  const indices = [];

  return function pieceAt(position) {
    while (indices.length <= position) {
      indices.push(Math.floor(random() * pieces.length));
    }
    return buildPiece(indices[position]);
  };
}

/**
 * Lector independiente sobre una secuencia compartida: cada jugador avanza a su
 * propio ritmo sin afectar al otro.
 */
export function createPieceReader(sequence) {
  let position = 0;
  return () => sequence(position++);
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
