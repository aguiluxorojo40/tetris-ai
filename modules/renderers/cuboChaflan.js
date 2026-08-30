// modules/renderers/cuboChaflan.js
//
// Genera un cubo con chaflán en todas sus aristas. Se construye por código en
// lugar de cargar un modelo: son 108 triángulos, así que describirlo cuesta
// menos que descargarlo. Comparado con el bloque equivalente generado con
// Meshy (4.434 triángulos, 152 KB), la imagen resultante difiere en un error
// medio de 4/255 por canal, medida sobre un tablero lleno.
//
// El chaflán no es decoración: un cubo recto iluminado de frente se ve como un
// cuadrado plano, mientras que los biseles devuelven la luz en otro ángulo y
// dibujan un borde claro alrededor de cada bloque. Es lo que hace que la pila
// se lea como piezas sueltas y no como una mancha de color.
//
// La malla tiene tres regiones:
//   - 6 caras planas, las del cubo, encogidas por el chaflán
//   - 12 biseles de arista, un cuarto de cilindro cada uno
//   - 8 esquinas, un octavo de esfera cada una
//
// Con un solo tramo los biseles degeneran en el chaflán plano clásico a 45°
// (44 triángulos), y entonces las normales pasan a ser planas para que las
// aristas queden marcadas en vez de emborronadas.

/** Ancho del chaflán, en fracción del lado. */
export const CHAFLAN_POR_DEFECTO = 0.09;

// Tramos en que se divide el bisel. Con 1 queda un chaflán plano a 45°; con 2
// ya se redondea y es indistinguible de uno de 8 tramos (0,3% de los píxeles),
// así que subir de ahí sólo añade triángulos.
export const SEGMENTOS_POR_DEFECTO = 2;

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
 * @param {number} segmentos Tramos del bisel. Con 1 queda un chaflán plano a
 *                         45°; a partir de 2 se redondea, siguiendo un
 *                         cilindro en las aristas y una esfera en las
 *                         esquinas, con normales suaves.
 * @returns {{positions: number[], normals: number[], uvs: number[], indices: number[]}}
 *          Arrays planos, listos para una BufferGeometry.
 */
export function crearCuboChaflan(
  lado = 1,
  chaflan = CHAFLAN_POR_DEFECTO,
  segmentos = SEGMENTOS_POR_DEFECTO
) {
  const h = lado / 2;
  const tramos = Math.max(1, Math.round(segmentos));
  const c = Math.min(Math.max(chaflan, 0.001), 1 / 3) * lado;
  const a = h - c; // hasta dónde llega la cara plana antes de biselarse

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Coordenadas de textura por proyección: cada polígono se proyecta sobre el
  // plano perpendicular a su eje dominante, o sea la cara del cubo a la que
  // mira. Es lo que corresponde a un bloque: las seis caras salen sin
  // deformar, y en los biseles la proyección se estrecha un poco, cosa que
  // con una textura de grano no se aprecia. Se calcula por polígono y no por
  // vértice para que todos sus vértices compartan proyección.
  const proyectar = (puntos, direccion) => {
    let dominante = 0;
    for (let i = 1; i < 3; i++) {
      if (Math.abs(direccion[i]) > Math.abs(direccion[dominante])) dominante = i;
    }
    const u = (dominante + 1) % 3;
    const v = (dominante + 2) % 3;
    for (const p of puntos) {
      uvs.push(p[u] / lado + 0.5, p[v] / lado + 0.5);
    }
  };

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
    proyectar(puntos, normal);
    for (let i = 1; i < puntos.length - 1; i++) {
      indices.push(base, base + i, base + i + 1);
    }
  };

  // Igual que cara(), pero con una normal por vértice: es lo que redondea el
  // bisel. La orientación se decide comparando el giro del polígono con la
  // media de sus normales, que en una superficie convexa apuntan al mismo
  // lado.
  const caraSuave = (puntos, normalesCara) => {
    const giro = cruz(resta(puntos[1], puntos[0]), resta(puntos[2], puntos[0]));
    const media = normalesCara.reduce(
      (acc, n) => [acc[0] + n[0], acc[1] + n[1], acc[2] + n[2]], [0, 0, 0]
    );
    if (punto(giro, media) < 0) {
      puntos = [...puntos].reverse();
      normalesCara = [...normalesCara].reverse();
    }

    const base = positions.length / 3;
    puntos.forEach((p, i) => {
      positions.push(p[0], p[1], p[2]);
      normals.push(normalesCara[i][0], normalesCara[i][1], normalesCara[i][2]);
    });
    proyectar(puntos, media);
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

  // El bisel redondeado es la suma de Minkowski del cubo interior (medio lado
  // a) con una bola de radio c: para una normal n, el punto de la superficie
  // es la esquina del cubo interior en esa dirección más c·n. Sale exacto y,
  // de propina, la normal ya viene dada. Con un solo tramo, esa fórmula
  // devuelve justo las tres caras del chaflán plano.
  const superficie = (n, signos) => [
    signos[0] * a + c * n[0],
    signos[1] * a + c * n[1],
    signos[2] * a + c * n[2],
  ];

  // Los 12 chaflanes de arista: un cuarto de cilindro que une la cara de un
  // eje con la del otro, recorriendo el eje libre de -a a +a.
  for (let i = 0; i < 3; i++) {
    for (const sj of [1, -1]) {
      for (const sk of [1, -1]) {
        for (let t = 0; t < tramos; t++) {
          const arco = (paso) => {
            const ang = (paso / tramos) * (Math.PI / 2);
            return eje(i, 0, sj * Math.cos(ang), sk * Math.sin(ang));
          };
          const n0 = arco(t);
          const n1 = arco(t + 1);
          // El eje libre no participa: se fija a mano después.
          const signos = eje(i, 0, sj, sk);
          const p = (n, libre) => {
            const q = superficie(n, signos);
            q[i] = libre;
            return q;
          };
          const cara0 = [p(n0, -a), p(n0, a), p(n1, a), p(n1, -a)];
          // Con el bisel plano (un tramo) la cara es un rectángulo a 45° y su
          // normal es la misma en las cuatro esquinas.
          if (tramos === 1) cara(cara0);
          else caraSuave(cara0, [n0, n0, n1, n1]);
        }
      }
    }
  }

  // Las 8 esquinas: el octante de esfera donde se juntan los tres biseles.
  // Se recorre en anillos desde el polo del eje Y.
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        const normal = (anillo, paso) => {
          const theta = (anillo / tramos) * (Math.PI / 2);
          const phi = (paso / tramos) * (Math.PI / 2);
          return [
            sx * Math.sin(theta) * Math.cos(phi),
            sy * Math.cos(theta),
            sz * Math.sin(theta) * Math.sin(phi),
          ];
        };
        for (let anillo = 0; anillo < tramos; anillo++) {
          for (let paso = 0; paso < tramos; paso++) {
            const a0 = normal(anillo, paso);
            const a1 = normal(anillo, paso + 1);
            const b0 = normal(anillo + 1, paso);
            const b1 = normal(anillo + 1, paso + 1);
            // En el anillo del polo los dos vértices de arriba son el mismo
            // punto: ahí la celda es un triángulo, no un cuadrilátero.
            const ns = anillo === 0 ? [a0, b0, b1] : [a0, b0, b1, a1];
            const ps = ns.map(n => superficie(n, [sx, sy, sz]));
            if (tramos === 1) cara(ps);
            else caraSuave(ps, ns);
          }
        }
      }
    }
  }

  return { positions, normals, uvs, indices };
}

export default crearCuboChaflan;
