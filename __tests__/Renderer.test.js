import Board from '../modules/Board.js';
import { getRandomPiece } from '../modules/Utils.js';
import {
  MATERIALES,
  GRUPO_LISO,
  grupoDe,
  grupos,
  materialDe,
} from '../modules/renderers/materiales.js';
import {
  crearCuboChaflan,
  CHAFLAN_POR_DEFECTO,
  SEGMENTOS_POR_DEFECTO,
} from '../modules/renderers/cuboChaflan.js';
import DomRenderer, {
  EMPTY_COLOR,
  GARBAGE_COLOR,
  GHOST_COLOR,
} from '../modules/renderers/DomRenderer.js';

// Renderizador de mentira: sirve para comprobar que Board delega, sin
// depender de WebGL (que jsdom no tiene). El de verdad se verifica en el
// navegador.
function fakeRenderer() {
  return {
    init: jest.fn(),
    drawCells: jest.fn(),
    drawPiece: jest.fn(),
    drawGhost: jest.fn(),
    dispose: jest.fn(),
  };
}

describe('Board — abstracción del renderizador', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
  });

  test('por defecto usa la rejilla de divs', () => {
    const board = new Board(10, 20, element);
    expect(board.renderer).toBeInstanceOf(DomRenderer);
    expect(element.children.length).toBe(200);
  });

  test('acepta un renderizador propio y lo inicializa', () => {
    const renderer = fakeRenderer();
    new Board(10, 20, element, renderer);
    expect(renderer.init).toHaveBeenCalledWith(element, 10, 20);
  });

  test('delega el dibujado en el renderizador', () => {
    const renderer = fakeRenderer();
    const board = new Board(10, 20, element, renderer);
    const piece = { shape: [[1]], x: 0, y: 0, color: 'red' };

    board.draw();
    board.drawPiece(piece);
    board.drawGhost(piece, 5);

    expect(renderer.drawCells).toHaveBeenCalledWith(board.grid);
    expect(renderer.drawPiece).toHaveBeenCalledWith(piece);
    expect(renderer.drawGhost).toHaveBeenCalledWith(piece, 5);
  });

  // Cambiar de 2D a 3D en mitad de una partida no puede perder el tablero.
  test('setRenderer conserva el estado y desecha el anterior', () => {
    const primero = fakeRenderer();
    const segundo = fakeRenderer();
    const board = new Board(10, 20, element, primero);
    board.grid[19][0] = '#00e5e5';

    board.setRenderer(segundo);

    expect(primero.dispose).toHaveBeenCalled();
    expect(segundo.init).toHaveBeenCalledWith(element, 10, 20);
    expect(board.renderer).toBe(segundo);
    expect(board.grid[19][0]).toBe('#00e5e5'); // el tablero sigue igual
  });
});

describe('DomRenderer', () => {
  let element;
  let renderer;

  beforeEach(() => {
    element = document.createElement('div');
    renderer = new DomRenderer();
    renderer.init(element, 10, 20);
  });

  test('init crea una celda por posición', () => {
    expect(element.children.length).toBe(200);
  });

  test('init parte de cero al reinicializar', () => {
    renderer.init(element, 10, 20);
    expect(element.children.length).toBe(200);
  });

  test('drawCells usa el color guardado y el de fondo para las vacías', () => {
    const grid = Array.from({ length: 20 }, () => new Array(10).fill(0));
    grid[0][0] = '#00e5e5';
    grid[0][1] = 1; // valor "lleno" sin color: se pinta como basura

    renderer.drawCells(grid);

    expect(element.children[0].style.backgroundColor).toBe('rgb(0, 229, 229)');
    expect(element.children[1].style.backgroundColor).toBe('rgb(138, 138, 138)');
    expect(element.children[2].style.backgroundColor).toBe('rgb(68, 68, 68)');
  });

  test('drawGhost usa el color de la sombra', () => {
    renderer.drawGhost({ shape: [[1]], x: 0 }, 5);
    expect(element.children[50].style.backgroundColor).toBe(GHOST_COLOR);
  });

  test('los colores exportados son los esperados', () => {
    expect(EMPTY_COLOR).toBe('#444');
    expect(GARBAGE_COLOR).toBe('#8a8a8a');
    expect(GHOST_COLOR).not.toMatch(/255,\s*0,\s*0/);
  });

  test('dispose vacía el tablero', () => {
    renderer.dispose();
    expect(element.children.length).toBe(0);
  });
});

// Herramientas para leer la malla como triángulos.
const vertice = (m, i) => [
  m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2],
];
const normal = (m, i) => [
  m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2],
];
const cruz = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Clave para agrupar normales por dirección. Iguala el cero negativo al
// positivo: son la misma dirección, pero toFixed los escribe distinto.
const familia = (n) => n.map(v => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(5)).join(',');

// Volumen con signo por el teorema de la divergencia. Sólo sale positivo y con
// sentido si la malla está cerrada y todas las caras miran hacia fuera: una
// sola cara invertida o un hueco lo delatan.
const volumen = (m) => {
  let total = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = vertice(m, m.indices[t]);
    const b = vertice(m, m.indices[t + 1]);
    const c = vertice(m, m.indices[t + 2]);
    total += punto(a, cruz(b, c)) / 6;
  }
  return total;
};

// Recorre los triángulos comprobando que ninguno es degenerado y que su giro
// concuerda con las normales que se le han asignado.
const revisarTriangulos = (m) => {
  for (let t = 0; t < m.indices.length; t += 3) {
    const idx = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    const [a, b, c] = idx.map(i => vertice(m, i));
    const giro = cruz(resta(b, a), resta(c, a));
    const largo = Math.hypot(...giro);
    expect(largo).toBeGreaterThan(1e-9); // sin triángulos degenerados
    const media = [0, 1, 2].map(
      k => idx.reduce((suma, i) => suma + normal(m, i)[k], 0) / 3
    );
    expect(punto(giro.map(x => x / largo), media)).toBeGreaterThan(0);
  }
};

// Eje sobre el que está proyectada la textura de un polígono, o -1 si sus
// vértices no comparten proyección. La textura se proyecta sobre la cara del
// cubo a la que mira el polígono, así que sus tres vértices tienen que salir
// del mismo par de coordenadas; si no, la textura se rompería dentro del
// triángulo.
const ejeProyectado = (m, idx, lado) => {
  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3, v = (a + 2) % 3;
    if (idx.every(i => {
      const p = vertice(m, i);
      return Math.abs(m.uvs[i*2] - (p[u]/lado + 0.5)) < 1e-6
          && Math.abs(m.uvs[i*2+1] - (p[v]/lado + 0.5)) < 1e-6;
    })) return a;
  }
  return -1;
};

const revisarComun = (m, lado) => {
  expect(m.normals.length).toBe(m.positions.length);
  expect(m.uvs.length).toBe((m.positions.length / 3) * 2);
  expect(m.uvs.every(v => v >= 0 && v <= 1)).toBe(true);
  expect(m.indices.length % 3).toBe(0);
  expect(Math.min(...m.indices)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
  expect(m.positions.every(Number.isFinite)).toBe(true);

  // Ocupa exactamente el lado pedido, centrado en el origen.
  for (let i = 0; i < 3; i++) {
    const valores = m.positions.filter((_, k) => k % 3 === i);
    expect(Math.max(...valores)).toBeCloseTo(lado / 2, 6);
    expect(Math.min(...valores)).toBeCloseTo(-lado / 2, 6);
  }

  for (let i = 0; i < m.positions.length / 3; i++) {
    expect(Math.hypot(...normal(m, i))).toBeCloseTo(1, 6);
  }

  revisarTriangulos(m);

  for (let t = 0; t < m.indices.length; t += 3) {
    const idx = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    expect(ejeProyectado(m, idx, lado)).toBeGreaterThanOrEqual(0);
  }
};

describe('crearCuboChaflan — chaflán plano (un tramo)', () => {
  const LADO = 1;
  const modelo = crearCuboChaflan(LADO, 0.09, 1);

  test('son 6 caras, 12 chaflanes y 8 esquinas', () => {
    // 6·2 + 12·2 + 8 triángulos; normales planas, sin compartir vértices.
    expect(modelo.indices.length / 3).toBe(44);
    expect(modelo.positions.length / 3).toBe(96);
  });

  test('la malla es coherente', () => {
    revisarComun(modelo, LADO);
  });

  // La gracia del chaflán es que cada bisel devuelva la luz en su propio
  // ángulo: 6 direcciones de cara, 12 de arista y 8 de esquina.
  test('hay 26 orientaciones distintas de cara', () => {
    const familias = new Set();
    for (let i = 0; i < modelo.positions.length / 3; i++) {
      familias.add(familia(normal(modelo, i)));
    }
    expect(familias.size).toBe(26);

    const cuenta = { cara: 0, arista: 0, esquina: 0 };
    for (const clave of familias) {
      const ejes = clave.split(',').map(Number).filter(n => Math.abs(n) > 1e-6);
      if (ejes.length === 1) cuenta.cara++;
      else if (ejes.length === 2) cuenta.arista++;
      else cuenta.esquina++;
      // Los ejes activos reparten la normal a partes iguales: las caras
      // apuntan a ±1, los chaflanes a ±1/√2 y las esquinas a ±1/√3.
      for (const v of ejes) {
        expect(Math.abs(v)).toBeCloseTo(1 / Math.sqrt(ejes.length), 5);
      }
    }
    expect(cuenta).toEqual({ cara: 6, arista: 12, esquina: 8 });
  });

  test('la malla está cerrada y todas las caras miran hacia fuera', () => {
    // Un cubo achaflanado es un pelín menor que el cubo recto: sólo le faltan
    // los biseles.
    const v = volumen(modelo);
    expect(v).toBeGreaterThan(0.9 * LADO ** 3);
    expect(v).toBeLessThan(LADO ** 3);
  });

  test('la normal guardada coincide con el giro de cada triángulo', () => {
    for (let t = 0; t < modelo.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map(k => vertice(modelo, modelo.indices[t + k]));
      const giro = cruz(resta(b, a), resta(c, a));
      const largo = Math.hypot(...giro);
      const unitaria = giro.map(x => x / largo);
      expect(punto(unitaria, normal(modelo, modelo.indices[t]))).toBeCloseTo(1, 5);
    }
  });

  test('no queda ninguna esquina en pico: están todas cortadas', () => {
    const h = LADO / 2;
    for (let i = 0; i < modelo.positions.length / 3; i++) {
      const enPico = vertice(modelo, i).every(v => Math.abs(Math.abs(v) - h) < 1e-9);
      expect(enPico).toBe(false);
    }
  });
});

describe('crearCuboChaflan — bisel redondeado', () => {
  // Volumen exacto del sólido: es la suma de Minkowski de un cubo de lado 2a
  // con una bola de radio c, o sea cubo + prismas de cara + cuartos de
  // cilindro en las aristas + una esfera entera repartida en las ocho
  // esquinas. La malla se le tiene que ir acercando conforme suben los tramos.
  const exacto = (lado, chaflan) => {
    const c = chaflan * lado;
    const a = lado / 2 - c;
    return (2 * a) ** 3
      + 6 * (2 * a) ** 2 * c
      + 12 * (Math.PI * c * c / 4) * (2 * a)
      + (4 / 3) * Math.PI * c ** 3;
  };

  test('el recuento de caras crece como toca', () => {
    // 12 de las caras planas + 24·t de las aristas + 8·(2t²−t) de las esquinas.
    for (const t of [2, 3, 4, 8]) {
      const esperados = 12 + 24 * t + 8 * (2 * t * t - t);
      expect(crearCuboChaflan(1, 0.09, t).indices.length / 3).toBe(esperados);
    }
  });

  test('la malla es coherente con cualquier número de tramos', () => {
    for (const t of [2, 3, 5, 8]) revisarComun(crearCuboChaflan(2, 0.09, t), 2);
  });

  test('el volumen converge al del sólido exacto', () => {
    const meta = exacto(1, 0.09);
    const dos = volumen(crearCuboChaflan(1, 0.09, 2));
    const ocho = volumen(crearCuboChaflan(1, 0.09, 8));
    const dieciseis = volumen(crearCuboChaflan(1, 0.09, 16));

    // Un poliedro inscrito siempre se queda corto, y cada subdivisión acorta
    // la diferencia.
    expect(dos).toBeLessThan(meta);
    expect(ocho).toBeGreaterThan(dos);
    expect(dieciseis).toBeGreaterThan(ocho);
    // Con 16 tramos la malla se queda a un 0,01% del sólido exacto, y cada
    // subdivisión recorta ese hueco a la mitad larga.
    expect((meta - dieciseis) / meta).toBeLessThan(0.0005);
    expect(meta - dieciseis).toBeLessThan((meta - ocho) / 2);
  });

  // Si las normales no variaran dentro de cada triángulo, el bisel se vería
  // facetado igual que el chaflán plano y no habría redondeo ninguno.
  test('las normales del bisel son suaves, no planas', () => {
    const m = crearCuboChaflan(1, 0.09, 3);
    let suaves = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const ns = [0, 1, 2].map(k => normal(m, m.indices[t + k]));
      if (punto(ns[0], ns[1]) < 0.9999 || punto(ns[1], ns[2]) < 0.9999) suaves++;
    }
    // Las 12 caras planas del cubo no cuentan; el resto sí.
    expect(suaves).toBe(m.indices.length / 3 - 12);
  });

  test('las seis caras del cubo siguen siendo planas', () => {
    const m = crearCuboChaflan(1, 0.09, 4);
    const planas = new Set();
    for (let i = 0; i < m.positions.length / 3; i++) {
      const n = normal(m, i);
      if (Math.max(...n.map(Math.abs)) > 0.9999) planas.add(familia(n));
    }
    expect(planas.size).toBe(6);
  });
});

describe('crearCuboChaflan — coordenadas de textura', () => {
  test('cada polígono se proyecta sobre la cara a la que mira', () => {
    for (const tramos of [1, 2, 4]) {
      const m = crearCuboChaflan(1, 0.09, tramos);
      for (let t = 0; t < m.indices.length; t += 3) {
        const idx = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
        const a = ejeProyectado(m, idx, 1);
        expect(a).toBeGreaterThanOrEqual(0);
        // Y la cara nunca queda de canto respecto a ese eje, que es lo que
        // estiraría la textura sin límite. El eje lo elige la normal del
        // polígono, no la de cada vértice: en un bisel redondeado las
        // normales de los vértices se abren, así que el corte se pone donde
        // el peor de ellos sigue holgado.
        for (const i of idx) {
          expect(Math.abs(normal(m, i)[a])).toBeGreaterThan(0.4);
        }
      }
    }
  });

  test('las seis caras planas ocupan el mismo cuadrado interior', () => {
    const m = crearCuboChaflan(1, 0.09, 1);
    const us = [], vs = [];
    for (let t = 0; t < m.indices.length; t += 3) {
      const n = normal(m, m.indices[t]);
      if (Math.max(...n.map(Math.abs)) < 0.9999) continue;
      for (const k of [0, 1, 2]) {
        us.push(m.uvs[m.indices[t + k] * 2]);
        vs.push(m.uvs[m.indices[t + k] * 2 + 1]);
      }
    }
    // La cara plana llega hasta ±(lado/2 − chaflán), o sea de 0,09 a 0,91.
    for (const eje of [us, vs]) {
      expect(Math.min(...eje)).toBeCloseTo(0.09, 6);
      expect(Math.max(...eje)).toBeCloseTo(0.91, 6);
    }
  });

  test('no dependen del tamaño del cubo', () => {
    // Se normalizan por el lado, así que un bloque grande no estira la
    // textura respecto a uno pequeño.
    const chico = crearCuboChaflan(1, 0.09, 2);
    const grande = crearCuboChaflan(7, 0.09, 2);
    expect(grande.uvs.length).toBe(chico.uvs.length);
    grande.uvs.forEach((v, i) => expect(v).toBeCloseTo(chico.uvs[i], 6));
  });
});

describe('crearCuboChaflan — parámetros', () => {
  test('a más chaflán, menos volumen, y el recuento de caras no cambia', () => {
    const suave = crearCuboChaflan(1, 0.04);
    const marcado = crearCuboChaflan(1, 0.2);
    expect(volumen(marcado)).toBeLessThan(volumen(suave));
    expect(marcado.indices.length).toBe(suave.indices.length);
  });

  test('escala con el lado', () => {
    expect(volumen(crearCuboChaflan(4))).toBeCloseTo(volumen(crearCuboChaflan(1)) * 64, 4);
  });

  // El chaflán se limita a un tercio del lado: pasado ese punto las caras se
  // cruzan y el cubo se convierte en un octaedro.
  test('aguanta valores absurdos sin degenerar', () => {
    for (const chaflan of [0, -5, 0.5, 10]) {
      for (const tramos of [1, 3]) {
        const m = crearCuboChaflan(1, chaflan, tramos);
        expect(volumen(m)).toBeGreaterThan(0);
        revisarComun(m, 1);
      }
    }
  });

  test('los tramos se redondean a un entero de 1 para arriba', () => {
    const uno = crearCuboChaflan(1, 0.09, 1).indices.length;
    for (const tramos of [0, -3, 0.4, 1.2]) {
      expect(crearCuboChaflan(1, 0.09, tramos).indices.length).toBe(uno);
    }
  });

  test('los valores por defecto son un bisel discreto y redondeado', () => {
    expect(CHAFLAN_POR_DEFECTO).toBeGreaterThan(0);
    expect(CHAFLAN_POR_DEFECTO).toBeLessThan(0.2);
    expect(SEGMENTOS_POR_DEFECTO).toBe(2);
    expect(crearCuboChaflan(1).indices.length).toBe(
      crearCuboChaflan(1, CHAFLAN_POR_DEFECTO, SEGMENTOS_POR_DEFECTO).indices.length
    );
  });
});


describe('materiales — qué viste cada tetromino', () => {
  // Los colores salen de las piezas de verdad, no de una copia: si algún día
  // se retoca la paleta de Utils.js, el registro tiene que enterarse en vez de
  // quedarse apuntando a un color que ya no existe.
  const piezas = new Map();
  // Dos bolsas completas garantizan las siete piezas, sea cual sea el punto
  // de la bolsa en el que arranque.
  for (let i = 0; i < 14; i++) {
    const pieza = getRandomPiece();
    piezas.set(pieza.color.toLowerCase(), pieza.type);
  }

  test('las siete piezas están representadas en la muestra', () => {
    expect(piezas.size).toBe(7);
  });

  test('cada material apunta a un color de pieza que existe', () => {
    for (const [color, material] of Object.entries(MATERIALES)) {
      expect(piezas.has(color)).toBe(true);
      // Y dice de qué pieza es, que es lo que se lee al añadir una textura.
      expect(material.pieza).toBe(piezas.get(color));
    }
  });

  test('el queso viste a la O, que es la pieza amarilla', () => {
    const [color, material] = Object.entries(MATERIALES)
      .find(([, m]) => m.textura.includes('queso'));
    expect(piezas.get(color)).toBe('O');
    expect(material.pieza).toBe('O');
  });

  test('los parámetros de cada material están en rango', () => {
    for (const material of Object.values(MATERIALES)) {
      expect(typeof material.textura).toBe('string');
      expect(material.textura).toMatch(/^\.\/assets\//);
      // La escala acerca el grano; por encima de 1 lo alejaría hasta perderlo.
      expect(material.escala).toBeGreaterThan(0);
      expect(material.escala).toBeLessThanOrEqual(1);
      // 0 es material puro y 1 el color plano de siempre.
      expect(material.tinte).toBeGreaterThanOrEqual(0);
      expect(material.tinte).toBeLessThanOrEqual(1);
    }
  });

  test('las claves del registro están en minúsculas y sin repetir', () => {
    const claves = Object.keys(MATERIALES);
    expect(claves).toEqual(claves.map(c => c.toLowerCase()));
    expect(new Set(claves).size).toBe(claves.length);
  });

  test('cada color va a su grupo, y el resto al liso', () => {
    for (const color of piezas.keys()) {
      const esperado = color in MATERIALES ? color : GRUPO_LISO;
      expect(grupoDe(color)).toBe(esperado);
    }
    expect(grupoDe(GARBAGE_COLOR)).toBe(GRUPO_LISO);
    expect(grupoDe('#123456')).toBe(GRUPO_LISO);
  });

  test('el reparto no depende de mayúsculas ni de espacios', () => {
    for (const color of Object.keys(MATERIALES)) {
      expect(grupoDe(color.toUpperCase())).toBe(color);
      expect(grupoDe(` ${color} `)).toBe(color);
    }
  });

  test('hay un grupo por material más el liso, sin repetidos', () => {
    const lista = grupos();
    expect(lista[0]).toBe(GRUPO_LISO);
    expect(lista.length).toBe(Object.keys(MATERIALES).length + 1);
    expect(new Set(lista).size).toBe(lista.length);
  });

  test('materialDe sólo devuelve algo para los colores con textura', () => {
    for (const color of piezas.keys()) {
      expect(materialDe(color)).toBe(MATERIALES[color] || null);
    }
    expect(materialDe(GRUPO_LISO)).toBeNull();
    expect(materialDe('#123456')).toBeNull();
  });
});
