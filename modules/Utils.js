import { Piece } from './Piece.js';

// Colores según la Tetris Guideline: cada forma tiene el suyo.
// I azul claro, J azul oscuro, L naranja, O amarillo, S verde, Z rojo,
// T magenta.
//
// Las etiquetas de L y J estaban intercambiadas: lo que se llamaba 'L' tenía
// la forma de una J y al revés. Los colores sí acompañaban a su forma, así que
// sólo hubo que corregir los nombres.
const pieces = [
  { type: 'I', shape: [[1, 1, 1, 1]], color: '#00e5e5' },

  { type: 'O', shape: [[1, 1],
                       [1, 1]], color: '#e5e500' },

  { type: 'T', shape: [[0, 1, 0],
                       [1, 1, 1]], color: '#a000e5' },

  { type: 'S', shape: [[0, 1, 1],
                       [1, 1, 0]], color: '#00d000' },

  { type: 'Z', shape: [[1, 1, 0],
                       [0, 1, 1]], color: '#e52020' },

  { type: 'J', shape: [[1, 0, 0],
                       [1, 1, 1]], color: '#2040e5' },

  { type: 'L', shape: [[0, 0, 1],
                       [1, 1, 1]], color: '#e59000' },
];

// Clonamos la forma para que cada pieza tenga su propia matriz (rotaciones
// independientes) y no se mute la definición compartida.
function buildPiece(index) {
  const { shape, color, type } = pieces[index];
  return new Piece(shape.map(row => [...row]), color, type);
}

/**
 * Baraja una "bolsa" con las 7 piezas (Fisher-Yates). Es el Random Generator
 * que exige la Tetris Guideline: cada tanda reparte una vez cada pieza, de modo
 * que nunca hay sequías largas. Con azar uniforme puedes pasarte veinte piezas
 * sin ver una I, y en un duelo eso decide la partida.
 */
export function shuffledBag(random) {
  const bag = pieces.map((_, index) => index);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

let defaultBag = [];

export function getRandomPiece() {
  if (defaultBag.length === 0) defaultBag = shuffledBag(Math.random);
  return buildPiece(defaultBag.shift());
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
  let bag = [];

  return function pieceAt(position) {
    while (indices.length <= position) {
      if (bag.length === 0) bag = shuffledBag(random);
      indices.push(bag.shift());
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
