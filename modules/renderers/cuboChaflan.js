// modules/renderers/cuboChaflan.js
//
// Genera un cubo con chaflán en todas sus aristas. Se construye por código en
// lugar de cargar un modelo: un cubo achaflanado son 44 triángulos, así que
// describirlo cuesta menos que descargarlo (el modelo de Meshy equivalente
// ocupaba 119 KB ya reducido, y 35 MB sin reducir).
//
// El chaflán no es decoración: un cubo recto iluminado de frente se ve como un
// cuadrado plano, mientras que los biseles devuelven la luz en otro ángulo y
// dibujan un borde claro alrededor de cada bloque. Es lo que hace que la pila
// se lea como piezas sueltas y no como una mancha de color.
//
// La malla tiene tres tipos de cara:
//   - 6 cuadrados, las caras del cubo, encogidas por el chaflán
//   - 12 cuadrados, un chaflán por arista, a 45°
//   - 8 triángulos, uno por esquina, donde se cruzan tres chaflanes
//
// Las normales son planas (cada cara con la suya, sin compartir vértices) para
// que los biseles queden marcados; suavizarlas los emborronaría.

/** Ancho del chaflán, en fracción del lado. */
export const CHAFLAN_POR_DEFECTO = 0.09;

const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cruz = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalizar(v) {
  const largo = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / largo, v[1] / largo, v[2] / largo];
}

/**
 * Construye la geometría del cubo achaflanado.
 *
 * @param {number} lado    Arista del cubo, medida entre caras opuestas.
 * @param {number} chaflan Ancho del bisel, en fracción del lado. Se limita a
 *                         un tercio: por encima de eso el cubo degenera en un
 *                         octaedro y deja de leerse como bloque.
 * @returns {{positions: number[], normals: number[], indices: number[]}}
 *          Arrays planos, listos para una BufferGeometry.
 */
export function crearCuboChaflan(lado = 1, chaflan = CHAFLAN_POR_DEFECTO) {
  const h = lado / 2;
  const c = Math.min(Math.max(chaflan, 0.001), 1 / 3) * lado;
  const a = h - c; // hasta dónde llega la cara plana antes de biselarse

  const positions = [];
  const normals = [];
  const indices = [];

  // Añade un polígono convexo como abanico de triángulos, con una única normal
  // para todos sus vértices. El sólido es convexo y está centrado en el origen,
  // así que la normal correcta es la que se aleja del centro: si apunta hacia
  // dentro, se invierte el orden de los vértices. Sale más barato que llevar la
  // cuenta del sentido de giro en cada uno de los tres tipos de cara.
  const cara = (puntos) => {
    let normal = normalizar(cruz(
      resta(puntos[1], puntos[0]),
      resta(puntos[2], puntos[0])
    ));
    if (punto(normal, puntos[0]) < 0) {
      puntos = [...puntos].reverse();
      normal = [-normal[0], -normal[1], -normal[2]];
    }

    const base = positions.length / 3;
    for (const p of puntos) {
      positions.push(p[0], p[1], p[2]);
      normals.push(normal[0], normal[1], normal[2]);
    }
    for (let i = 1; i < puntos.length - 1; i++) {
      indices.push(base, base + i, base + i + 1);
    }
  };

  // Punto a partir de un eje y sus dos perpendiculares, para no repetir la
  // permutación de coordenadas en cada bucle.
  const eje = (i, vi, vj, vk) => {
    const p = [];
    p[i] = vi;
    p[(i + 1) % 3] = vj;
    p[(i + 2) % 3] = vk;
    return p;
  };

  // Las 6 caras del cubo, encogidas a ±a en sus dos ejes libres.
  for (let i = 0; i < 3; i++) {
    for (const s of [1, -1]) {
      cara([
        eje(i, s * h, -a, -a),
        eje(i, s * h, a, -a),
        eje(i, s * h, a, a),
        eje(i, s * h, -a, a),
      ]);
    }
  }

  // Los 12 chaflanes de arista: un rectángulo a 45° que une la cara de un eje
  // con la del otro, recorriendo el eje libre de -a a +a.
  for (let i = 0; i < 3; i++) {
    for (const sj of [1, -1]) {
      for (const sk of [1, -1]) {
        cara([
          eje(i, -a, sj * h, sk * a),
          eje(i, a, sj * h, sk * a),
          eje(i, a, sj * a, sk * h),
          eje(i, -a, sj * a, sk * h),
        ]);
      }
    }
  }

  // Las 8 esquinas: el triángulo que tapa el hueco donde se juntan los tres
  // chaflanes que llegan a ese vértice.
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        cara([
          [sx * h, sy * a, sz * a],
          [sx * a, sy * h, sz * a],
          [sx * a, sy * a, sz * h],
        ]);
      }
    }
  }

  return { positions, normals, indices };
}

export default crearCuboChaflan;
