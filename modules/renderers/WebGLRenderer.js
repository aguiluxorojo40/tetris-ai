// modules/renderers/WebGLRenderer.js
//
// Dibuja el tablero en 3D con three.js. Cumple la misma interfaz que
// DomRenderer (init / drawCells / drawPiece / drawGhost / dispose), así que
// Board no distingue uno de otro.
//
// three.js pesa unos 670 KB, de modo que este módulo se importa de forma
// dinámica y sólo al activar el modo 3D: una partida normal no carga nada.

import * as THREE from 'three';

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

// Reserva de cubos: 200 del tablero + 4 de la pieza + 4 de la sombra, con
// holgura. Se reutilizan siempre los mismos para no crear objetos por frame.
const POOL_SIZE = 220;

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

    // Un único cubo, reutilizado: es exactamente el plan del cubo de Meshy.
    // Cuando haya un modelo, basta con sustituir esta geometría.
    this.geometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const cubo = new THREE.Mesh(
        this.geometry,
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      cubo.visible = false;
      this.scene.add(cubo);
      this.pool.push(cubo);
    }

    this.usados = 0;
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

  /** Coloca el siguiente cubo libre de la reserva. */
  colocar(x, y, color, opacidad = 1) {
    if (this.usados >= this.pool.length) return;

    const cubo = this.pool[this.usados++];
    // Coordenadas de tablero a mundo: x hacia la derecha, y hacia abajo.
    cubo.position.set(x - (this.width - 1) / 2, (this.height - 1) / 2 - y, 0);
    cubo.material.color.set(color);
    cubo.material.transparent = opacidad < 1;
    cubo.material.opacity = opacidad;
    cubo.scale.setScalar(opacidad < 1 ? 0.7 : 1); // la sombra, más pequeña
    cubo.visible = true;
  }

  /** Empieza un fotograma nuevo: oculta todo y repuebla. */
  drawCells(grid) {
    for (const cubo of this.pool) cubo.visible = false;
    this.usados = 0;

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
        if (shape[sy][sx]) this.colocar(x + sx, ghostY + sy, GHOST_COLOR, 0.35);
      }
    }
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    for (const cubo of this.pool) cubo.material.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
    if (this.element) {
      this.element.classList.remove('webgl');
      this.element.innerHTML = '';
    }
  }
}
