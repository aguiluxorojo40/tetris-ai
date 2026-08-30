// modules/renderers/WebGLRenderer.js
//
// Dibuja el tablero en 3D con three.js. Cumple la misma interfaz que
// DomRenderer (init / drawCells / drawPiece / drawGhost / dispose), así que
// Board no distingue uno de otro.
//
// three.js pesa unos 670 KB, de modo que este módulo se importa de forma
// dinámica y sólo al activar el modo 3D: una partida normal no carga nada.

import * as THREE from 'three';
import { crearCuboChaflan } from './cuboChaflan.js';
import { conRabillo, grupoDe, grupos, materialDe } from './materiales.js';
import { cimaDePieza, cimasConRabillo } from './rabillos.js';

const FOV = 30;

// Margen alrededor del tablero, para que no quede pegado a los bordes.
const MARGEN = 1.12;

// Inclinación de la cámara, como fracción de su distancia. Sin ella los cubos
// se ven de frente y parecen cuadrados planos; con esto asoman las caras
// superiores y se lee el volumen. Subirla mucho deforma la rejilla y estorba
// para calcular dónde cae la pieza.
const INCLINACION = 0.13;

const GARBAGE_COLOR = 0x8a8a8a;
const GHOST_COLOR = 0xffffff;

/**
 * Color de una casilla de la rejilla. Las piezas guardan el suyo; la basura,
 * un simple 1. Una casilla vacía no es de ningún color.
 */
const colorDe = (valor) => {
  if (!valor) return null;
  return typeof valor === 'string' ? valor : GARBAGE_COLOR;
};

// Cubos como mucho en pantalla: 200 del tablero + 4 de la pieza, con holgura.
const MAX_BLOQUES = 210;
const MAX_SOMBRA = 8;

// Hueco entre bloques contiguos: el cubo no llena la casilla entera.
const LADO_CUBO = 0.92;

/** Pasa el cubo achaflanado a una geometría de three.js. */
function geometriaCubo() {
  const { positions, normals, uvs, indices } = crearCuboChaflan(LADO_CUBO);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export default class WebGLRenderer {
  init(element, width, height) {
    this.width = width;
    this.height = height;
    this.element = element;

    // La rejilla de divs se sustituye por un canvas.
    element.innerHTML = '';
    element.classList.add('webgl');
    this.canvas = document.createElement('canvas');
    element.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();

    // Cámara en perspectiva suave: da volumen sin deformar la rejilla, que
    // tiene que seguir leyéndose como un tablero de Tetris. La distancia la
    // calcula encuadrar(), porque depende de la proporción del contenedor.
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const luz = new THREE.DirectionalLight(0xffffff, 2.2);
    luz.position.set(-6, 10, 12);
    this.scene.add(luz);
    const relleno = new THREE.DirectionalLight(0x88aaff, 0.7);
    relleno.position.set(8, -4, 6);
    this.scene.add(relleno);

    // Fondo del tablero, para que las celdas vacías no queden transparentes.
    const fondo = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x1c1c1c })
    );
    fondo.position.z = -0.6;
    this.scene.add(fondo);

    // Un solo cubo dibujado muchas veces mediante instanciado: una llamada de
    // dibujo por material, en vez de una por bloque.
    this.geometry = geometriaCubo();
    this.crearGrupos();

    // La sombra va en su propia malla porque necesita material transparente.
    this.sombra = new THREE.InstancedMesh(
      this.geometry,
      new THREE.MeshLambertMaterial({
        color: GHOST_COLOR, transparent: true, opacity: 0.3,
      }),
      MAX_SOMBRA
    );
    this.sombra.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sombra.count = 0;
    this.scene.add(this.sombra);

    this.matriz = new THREE.Matrix4();
    this.color = new THREE.Color();
    this.blanco = new THREE.Color(0xffffff);
    this.escalaRabillo = new THREE.Vector3();
    this.usadosSombra = 0;

    this.cargarTexturas();
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Monta una malla instanciada por material. Todas comparten la misma
   * geometría —el cubo achaflanado— y sólo se diferencian en el material, así
   * que el coste de separarlas es una llamada de dibujo más por textura.
   *
   * Los bloques sin textura propia van todos juntos al grupo liso: el color va
   * por instancia, de modo que no necesitan uno cada uno.
   */
  crearGrupos() {
    this.grupos = new Map();
    for (const clave of grupos()) {
      // Phong en vez de Lambert por el brillo especular: es lo que enciende
      // los chaflanes y separa un bloque del de al lado.
      //
      // Un grupo con material propio es de una sola pieza, así que su color
      // es constante y va en el material en vez de instancia por instancia.
      // Arranca con el color íntegro de la Guideline: si la textura no llega,
      // esa pieza se ve de su color de siempre en lugar de desteñida.
      const material = new THREE.MeshPhongMaterial({
        shininess: 26, specular: 0x2a2a2a,
      });
      if (materialDe(clave)) material.color.set(clave);

      const malla = new THREE.InstancedMesh(
        this.geometry,
        material,
        // Un tablero entero puede ser de una sola pieza, así que cada grupo
        // se reserva para el caso peor. Son 13 KB de matrices por grupo.
        MAX_BLOQUES
      );
      malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      malla.count = 0;
      malla.usados = 0;
      this.grupos.set(clave, malla);
      this.scene.add(malla);
    }
    this.crearRabillos();
  }

  /**
   * Una malla más por cada material que corone sus bloques con un adorno. Es
   * decoración y nada más: el juego no sabe que existe, así que las piezas lo
   * atraviesan sin enterarse.
   *
   * Arranca invisible y con la geometría del cubo puesta de relleno. Cuando
   * llega la malla de verdad se cambia y se enciende; si no llega, el bloque
   * se queda sin adorno en vez de enseñar un sucedáneo que nadie ha elegido.
   */
  crearRabillos() {
    this.rabillos = new Map();
    for (const clave of conRabillo()) {
      const adorno = materialDe(clave).rabillo;

      const malla = new THREE.InstancedMesh(
        this.geometry,
        new THREE.MeshPhongMaterial({ color: adorno.color, shininess: 14 }),
        MAX_BLOQUES
      );
      malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      malla.count = 0;
      malla.usados = 0;
      malla.visible = false;
      this.rabillos.set(clave, malla);
      this.scene.add(malla);
    }
  }

  /**
   * Trae las texturas en segundo plano. El tablero ya se ve mientras tanto y,
   * si alguna no llega —sin archivo, sin permiso para leerlo—, esa pieza se
   * dibuja en color plano en lugar de dejar el juego sin pintar.
   */
  cargarTexturas() {
    this.texturas = [];
    this.geometriasRabillo = [];
    const cargador = new THREE.TextureLoader();

    for (const [clave, malla] of this.grupos) {
      const material = materialDe(clave);
      if (!material) continue;

      cargador.load(
        material.textura,
        (textura) => {
          if (!this.grupos) return; // se cambió de renderizador mientras cargaba
          textura.colorSpace = THREE.SRGBColorSpace;
          textura.repeat.set(material.escala, material.escala);
          textura.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          this.texturas.push(textura);
          malla.material.map = textura;
          // Ahora que hay material que enseñar, el color de la pieza pasa a
          // segundo plano: se acerca al blanco tanto como diga el tinte, de
          // modo que tiña el queso en vez de taparlo.
          malla.material.color.lerp(this.blanco, 1 - material.tinte);
          malla.material.needsUpdate = true;
          this.render();
        },
        undefined,
        () => {}
      );
    }

    this.cargarRabillos();
  }

  /**
   * Trae las mallas de los adornos, en el mismo formato plano que usa el
   * generador del cubo. Van aparte de las texturas porque son geometría, no
   * imágenes, y porque un adorno que no llegue no debe impedir que su textura
   * se vea.
   */
  cargarRabillos() {
    for (const [clave, malla] of this.rabillos) {
      const adorno = materialDe(clave).rabillo;

      fetch(adorno.malla)
        .then((respuesta) => (respuesta.ok ? respuesta.json() : Promise.reject()))
        .then(({ positions, normals, indices }) => {
          if (!this.rabillos) return; // se cambió de renderizador mientras cargaba
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
          geo.setIndex(indices);
          malla.geometry = geo;
          malla.visible = true;
          this.geometriasRabillo.push(geo);
          this.render();
        })
        .catch(() => {});
    }
  }

  resize() {
    const ancho = this.element.clientWidth || 1;
    const alto = this.element.clientHeight || 1;
    this.renderer.setSize(ancho, alto, false);
    this.camera.aspect = ancho / alto;
    this.encuadrar();
    this.render();
  }

  /**
   * Aleja la cámara lo justo para que quepa el tablero entero. Hay que atender
   * a las dos dimensiones: según la proporción del contenedor, unas veces
   * manda el alto y otras el ancho.
   */
  encuadrar() {
    const mitadFov = THREE.MathUtils.degToRad(FOV) / 2;
    const porAlto = (this.height / 2) / Math.tan(mitadFov);
    const porAncho = (this.width / 2) / (Math.tan(mitadFov) * this.camera.aspect);

    const distancia = Math.max(porAlto, porAncho) * MARGEN;
    this.camera.position.set(0, distancia * INCLINACION, distancia);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /** Sitúa una instancia en la casilla indicada, en el grupo de su material. */
  colocar(x, y, color) {
    const clave = grupoDe(color);
    const malla = this.grupos.get(clave);
    if (malla.usados >= MAX_BLOQUES) return;
    // Un cuarto de vuelta según la casilla. Todas las instancias comparten
    // geometría, así que sin esto todos los bloques enseñan exactamente la
    // misma mancha de la textura y se nota que están clonados. El cubo es
    // simétrico bajo ese giro, de modo que la silueta y la luz no cambian:
    // sólo rota la textura.
    this.matriz.makeRotationZ(((x * 7 + y * 3) % 4) * (Math.PI / 2));
    // Coordenadas de tablero a mundo: x hacia la derecha, y hacia abajo.
    this.matriz.setPosition(
      x - (this.width - 1) / 2, (this.height - 1) / 2 - y, 0
    );
    malla.setMatrixAt(malla.usados, this.matriz);

    // Los grupos con material propio ya llevan su color en el material, que es
    // el mismo para todas sus instancias. Sólo el grupo liso, que mezcla
    // piezas distintas y la basura, necesita color por instancia.
    if (!materialDe(clave)) malla.setColorAt(malla.usados, this.color.set(color));

    malla.usados++;
  }

  /** Corona un bloque con su adorno, apoyado en la cara de arriba. */
  colocarRabillo(x, y, color) {
    const clave = grupoDe(color);
    const malla = this.rabillos.get(clave);
    if (!malla || malla.usados >= MAX_BLOQUES) return;

    const { alto } = materialDe(clave).rabillo;
    // El giro va sobre su propio eje, no sobre Z como el del cubo: al cubo le
    // da igual porque es simétrico, pero al adorno lo tumbaría.
    this.matriz.makeRotationY(((x * 5 + y * 11) % 4) * (Math.PI / 2));
    this.matriz.scale(this.escalaRabillo.setScalar(alto));
    // La malla viene normalizada apoyada en y=0, así que se sube hasta la cara
    // superior del cubo.
    this.matriz.setPosition(
      x - (this.width - 1) / 2,
      (this.height - 1) / 2 - y + LADO_CUBO / 2,
      0
    );
    malla.setMatrixAt(malla.usados++, this.matriz);
  }

  colocarSombra(x, y) {
    if (this.usadosSombra >= MAX_SOMBRA) return;
    this.matriz.makeTranslation(
      x - (this.width - 1) / 2, (this.height - 1) / 2 - y, 0
    );
    this.matriz.scale(new THREE.Vector3(0.75, 0.75, 0.75));
    this.sombra.setMatrixAt(this.usadosSombra++, this.matriz);
  }

  /** Empieza un fotograma nuevo: vacía las instancias y repuebla. */
  drawCells(grid) {
    for (const malla of this.grupos.values()) malla.usados = 0;
    for (const malla of this.rabillos.values()) malla.usados = 0;
    this.usadosSombra = 0;

    // La pieza en juego se dibuja después y necesita saber qué tiene encima,
    // así que se guarda la rejilla de este fotograma.
    this.rejilla = grid;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const valor = grid[y][x];
        if (!valor) continue;
        this.colocar(x, y, colorDe(valor));
      }
    }
    for (const { x, y } of cimasConRabillo(grid)) {
      this.colocarRabillo(x, y, colorDe(grid[y][x]));
    }
    this.render();
  }

  drawPiece(piece) {
    const { x, y, shape, color = GARBAGE_COLOR } = piece;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] && y + sy >= 0) this.colocar(x + sx, y + sy, color);
      }
    }
    const cima = cimaDePieza({ x, y, shape, color }, this.rejilla);
    if (cima) this.colocarRabillo(cima.x, cima.y, color);
    this.render();
  }

  drawGhost(piece, ghostY) {
    const { x, shape } = piece;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx]) this.colocarSombra(x + sx, ghostY + sy);
      }
    }
    this.render();
  }

  render() {
    for (const malla of [...this.grupos.values(), ...this.rabillos.values()]) {
      malla.count = malla.usados;
      malla.instanceMatrix.needsUpdate = true;
      if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
    }
    this.sombra.count = this.usadosSombra;
    this.sombra.instanceMatrix.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    for (const malla of this.grupos.values()) malla.material.dispose();
    for (const malla of this.rabillos.values()) malla.material.dispose();
    for (const geo of this.geometriasRabillo) geo.dispose();
    for (const textura of this.texturas) textura.dispose();
    this.sombra.material.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
    // Marca el renderizador como desechado: si una textura o una malla llegan
    // después de cambiar a 2D, se descartan en vez de tocar una escena que ya
    // no existe.
    this.grupos = null;
    this.rabillos = null;
    if (this.element) {
      this.element.classList.remove('webgl');
      this.element.innerHTML = '';
    }
  }
}
