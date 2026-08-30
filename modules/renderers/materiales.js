// modules/renderers/materiales.js
//
// Qué material viste cada tetromino en el modo 3D.
//
// La idea es que la textura sea la identidad de la pieza, no una capa igual
// para todas: la O es un taco de queso, y cada pieza que se vaya texturizando
// será de lo suyo. Lo que no puede perderse es la esencia del Tetris, así que
// el color de la Guideline no desaparece, se queda como tinte sobre el
// material. Una pieza se reconoce entonces por dos vías a la vez, que en
// versus es lo que permite leer el tablero del rival de un vistazo.
//
// El registro se indexa por color porque es lo único que llega hasta aquí:
// Board.grid guarda el color de la pieza que se fijó, y drawPiece lo trae en
// piece.color. Así el renderizador reparte los bloques sin que Board ni Game
// tengan que saber nada de materiales.

/** Grupo de los bloques sin textura: color plano sobre el cubo achaflanado. */
export const GRUPO_LISO = 'liso';

/**
 * Materiales con textura, por color de la Guideline.
 *
 * - `textura`: ruta de la imagen, relativa al index.html.
 * - `escala`: porción de la textura que cubre cada cara. Por debajo de 1 se
 *   acerca el grano; si no, en un bloque de 25 píxeles se promedia hasta
 *   desaparecer.
 * - `tinte`: cuánto del color de la Guideline se mezcla sobre el material.
 *   0 es material puro y 1 es el color plano de siempre.
 * - `rabillo` (opcional): adorno que corona el bloque, con su malla, su color
 *   y su alto en unidades de casilla. Es decoración y nada más: no lo ve la
 *   colisión, ni el fijado de piezas, ni el despeje de líneas, ni la IA.
 */
export const MATERIALES = {
  // La O es la pieza amarilla y el queso es amarillo: material y color de la
  // Guideline coinciden en vez de pelearse, así que la O puede parecer queso
  // de verdad sin dejar de ser reconocible.
  '#e5e500': { pieza: 'O', textura: './assets/queso.jpg', escala: 0.5, tinte: 0.35 },

  // Lo mismo con la Z, que es la pieza roja. Su modelo traía rabillo, y ese
  // rabillo es lo único que se aprovecha de la geometría de Meshy.
  '#e52020': {
    pieza: 'Z', textura: './assets/tomate.jpg', escala: 0.5, tinte: 0.35,
    rabillo: { malla: './assets/rabillo.json', color: 0x2f6b2a, alto: 0.29 },
  },
};

/** Normaliza un color a la forma con la que se indexa el registro. */
const clave = (color) => String(color).trim().toLowerCase();

/**
 * Grupo de instancias al que va un bloque de este color. Los colores sin
 * material propio comparten el grupo liso: el color va por instancia, así que
 * no necesitan uno cada uno.
 */
export function grupoDe(color) {
  return clave(color) in MATERIALES ? clave(color) : GRUPO_LISO;
}

/** Definición del material de un color, o null si no tiene textura propia. */
export function materialDe(color) {
  return MATERIALES[clave(color)] || null;
}

/** Claves de todos los grupos: el liso y uno por material con textura. */
export function grupos() {
  return [GRUPO_LISO, ...Object.keys(MATERIALES)];
}

/** Materiales que coronan sus bloques con un adorno. */
export function conRabillo() {
  return Object.keys(MATERIALES).filter(c => MATERIALES[c].rabillo);
}
