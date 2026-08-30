// modules/renderers/rabillos.js
//
// Dónde va el rabillo del tomate.
//
// Un tetromino son cuatro casillas, y cuatro rabillos por pieza serían un
// despropósito: lo lleva el bloque que queda arriba. Como la rejilla sólo
// guarda colores y no de qué pieza vino cada bloque, «la pieza» se reconstruye
// mirando qué bloques del mismo color están pegados entre sí. Cada grupo luce
// un rabillo, en su casilla más alta.
//
// Y sólo si esa casilla tiene el hueco de arriba libre, que es lo que impide
// que el adorno se meta dentro del bloque de encima. El rabillo es decoración
// pura: no lo ve la colisión, ni el fijado de piezas, ni el despeje de líneas,
// ni la evaluación de la IA. Por eso las demás piezas lo atraviesan.

import { materialDe } from './materiales.js';

const VECINOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Casillas que lucen rabillo, una por grupo de bloques contiguos del mismo
 * color cuyo material lo lleve.
 *
 * @param {Array<Array<string|number>>} grid Rejilla del tablero.
 * @returns {Array<{x: number, y: number}>}
 */
export function cimasConRabillo(grid) {
  const alto = grid.length;
  const ancho = alto ? grid[0].length : 0;
  const visto = Array.from({ length: alto }, () => new Array(ancho).fill(false));
  const cimas = [];

  // Se recorre por filas de arriba abajo, así que la primera casilla que se
  // encuentra de cada grupo es ya la más alta y, dentro de ella, la más a la
  // izquierda: no hace falta compararlas después.
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const color = grid[y][x];
      if (visto[y][x] || !materialDe(color)?.rabillo) continue;

      visto[y][x] = true;
      const pendientes = [[x, y]];
      while (pendientes.length) {
        const [cx, cy] = pendientes.pop();
        for (const [dx, dy] of VECINOS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
          if (visto[ny][nx] || grid[ny][nx] !== color) continue;
          visto[ny][nx] = true;
          pendientes.push([nx, ny]);
        }
      }

      if (y === 0 || !grid[y - 1][x]) cimas.push({ x, y });
    }
  }
  return cimas;
}

/**
 * Casilla de la pieza en juego que luce rabillo, o null si no le toca. Va
 * aparte porque la pieza todavía no está en la rejilla, pero la regla es la
 * misma: su bloque más alto, y sólo con el hueco de encima libre.
 *
 * @param {{x: number, y: number, shape: number[][], color: string}} piece
 * @param {Array<Array<string|number>>} [grid] Rejilla, para mirar qué hay
 *        encima de la pieza. Sin ella se supone despejado.
 */
export function cimaDePieza(piece, grid) {
  const { x, y, shape, color } = piece;
  if (!materialDe(color)?.rabillo) return null;

  for (let sy = 0; sy < shape.length; sy++) {
    for (let sx = 0; sx < shape[sy].length; sx++) {
      if (!shape[sy][sx]) continue;
      const cx = x + sx;
      const cy = y + sy;
      if (cy < 0) return null; // aún asomando por encima del tablero
      const arriba = grid?.[cy - 1]?.[cx];
      return arriba ? null : { x: cx, y: cy };
    }
  }
  return null;
}
