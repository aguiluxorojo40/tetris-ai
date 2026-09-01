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

// Cubos como mucho en pantalla: 200 del tablero + 4 de la pieza, con holgura.
const MAX_BLOQUES = 210;
const MAX_SOMBRA = 8;

// Hueco entre bloques contiguos: el cubo no llena la casilla entera.
const LADO_CUBO = 0.92;

/** Pasa el cubo achaflanado a una geometría de three.js. */
function geometriaCubo() {
  const { positions, normals, indices } = crearCuboChaflan(LADO_CUBO);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
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

    // Un solo cubo dibujado muchas veces mediante instanciado: una única
    // llamada de dibujo para todo el tablero, en vez de una por bloque.
    this.geometry = geometriaCubo();

    // Phong en vez de Lambert por el brillo especular: es lo que enciende los
    // chaflanes y separa un bloque del de al lado cuando comparten color.
    this.bloques = new THREE.InstancedMesh(
      this.geometry,
      new THREE.MeshPhongMaterial({ shininess: 26, specular: 0x2a2a2a }),
      MAX_BLOQUES
    );
    this.bloques.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bloques.count = 0;
    this.scene.add(this.bloques);

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
    this.usados = 0;
    this.usadosSombra = 0;

    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
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

  /** Sitúa una instancia en la casilla indicada. */
  colocar(x, y, color) {
    if (this.usados >= MAX_BLOQUES) return;
    // Coordenadas de tablero a mundo: x hacia la derecha, y hacia abajo.
    this.matriz.makeTranslation(
      x - (this.width - 1) / 2, (this.height - 1) / 2 - y, 0
    );
    this.bloques.setMatrixAt(this.usados, this.matriz);
    this.bloques.setColorAt(this.usados, this.color.set(color));
    this.usados++;
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
    this.usados = 0;
    this.usadosSombra = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const valor = grid[y][x];
        if (!valor) continue;
        this.colocar(x, y, typeof valor === 'string' ? valor : GARBAGE_COLOR);
      }
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
    this.bloques.count = this.usados;
    this.bloques.instanceMatrix.needsUpdate = true;
    if (this.bloques.instanceColor) this.bloques.instanceColor.needsUpdate = true;
    this.sombra.count = this.usadosSombra;
    this.sombra.instanceMatrix.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.bloques.material.dispose();
    this.sombra.material.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
    if (this.element) {
      this.element.classList.remove('webgl');
      this.element.innerHTML = '';
    }
  }
}
