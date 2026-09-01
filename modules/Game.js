// modules/Game.js
import Board from './Board.js';
import { getRandomPiece, animateLineClear } from './Utils.js';
import { addControlListeners, removeControlListeners } from './Controls.js';

// Elementos que usa un tablero por defecto. En el modo versus el segundo
// jugador recibe otros ids, para que ambas partidas sean independientes.
// Tabla de ataque estándar del Tetris moderno: un simple no envía nada, un
// doble una fila, un triple dos y un tetris cuatro. Es la que documentan la
// Tetris Guideline y los modos versus clásicos.
export const ATTACK_TABLE = [0, 0, 1, 2, 4];

// Filas extra por combo, columna "Guideline Standard" de la tabla de TetrisWiki.
// El índice es el contador de combo, que empieza en -1: la primera línea lo deja
// en 0, la segunda consecutiva en 1, y así. De 13 en adelante se queda en 5.
export const COMBO_TABLE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5];

// Bonus por encadenar Tetris (back-to-back). La tabla da +2 para Tetris y TSD;
// aquí sólo aplica al Tetris, porque el juego no detecta T-spins.
export const BACK_TO_BACK_BONUS = 2;

// Vaciar el tablero por completo. La tabla lo cifra en 10 filas.
export const PERFECT_CLEAR_GARBAGE = 10;

// Probabilidad de que una fila de basura repita el hueco de la anterior.
// Con alineación total la basura "rebota" de un lado a otro sin control (la
// wiki lo describe como see-saw): quien la recibe la despeja con una I y te la
// devuelve entera. Tetris DS usa ~72%, y es el valor que adoptamos.
export const GARBAGE_ALIGNMENT = 0.72;

const DEFAULT_IDS = {
  board: 'board',
  score: 'score',
  level: 'level',
  nextPiece: 'nextPiece',
  startButton: 'startButton',
  garbage: 'garbage',
};

export default class Game {
  /**
   * @param {number} gravity - Milisegundos entre descensos automáticos.
   * @param {Object} [options]
   * @param {Object} [options.ids] - Ids de los elementos del DOM a usar.
   * @param {Function} [options.pieceSource] - De dónde salen las piezas. Permite
   *   compartir una secuencia entre dos jugadores.
   * @param {boolean} [options.controls] - Si escucha teclado y botones táctiles.
   *   El tablero de la IA no debe hacerlo.
   * @param {Function} [options.onGameOver] - Sustituye al aviso por defecto.
   * @param {Object} [options.renderer] - Cómo se dibuja el tablero. Por
   *   defecto, rejilla de divs; el modo 3D inyecta el renderizador de WebGL.
   */
  constructor(gravity, options = {}) {
    const ids = { ...DEFAULT_IDS, ...(options.ids || {}) };
    const byId = id => (id ? document.getElementById(id) : null);

    this.boardElement = byId(ids.board);
    this.scoreDisplay = byId(ids.score);
    this.levelDisplay = byId(ids.level);
    this.nextPieceBoard = byId(ids.nextPiece);
    this.startButton = byId(ids.startButton);
    this.garbageDisplay = byId(ids.garbage);

    this.pieceSource = options.pieceSource || getRandomPiece;
    this.onGameOver = options.onGameOver || null;
    this.onAttack = options.onAttack || null;
    this.useControls = options.controls !== false;
    this.random = options.random || Math.random;

    // Basura pendiente de recibir. Se acumula en cola y sólo entra al tablero
    // cuando se fija una pieza sin completar líneas: así da tiempo a
    // contrarrestarla, como en los modos versus clásicos.
    this.pendingGarbage = 0;

    // Contador de combo. Arranca en -1: la primera pieza que despeja lo deja
    // en 0, que todavía no da bonus.
    this.combo = -1;
    // Para el back-to-back: si la última jugada que despejó fue un Tetris.
    this.lastClearWasTetris = false;

    this.boardWidth = 10;
    this.boardHeight = 20;
    this.score = 0;
    this.level = 1;
    this.gravity = gravity;
    this.interval = null;

    this.board = new Board(
      this.boardWidth, this.boardHeight, this.boardElement, options.renderer || null
    );
    this.currentPiece = null;
    // Identificador incremental de la pieza en juego. La IA lo usa para saber
    // cuándo ha aparecido una pieza nueva y replantear.
    this.pieceId = 0;
    this.nextPiece = this.pieceSource();

    // Flags IA / Estado del juego
    this.isAIPlaying = false;
    this.isRunning = false;

    this.keydownHandler = this.handleKeyDown.bind(this);
    if (this.useControls) {
      addControlListeners(this);
      document.addEventListener('keydown', this.keydownHandler);
    }
  }

  start() {
    this.isRunning = true;
    if (this.startButton) this.startButton.disabled = true;
    this.spawnPiece();
    this.draw();
    this.interval = setInterval(() => this.movePiece(0, 1), this.gravity);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
    // Sólo retira los listeners quien los registró: de lo contrario el tablero
    // de la IA, al terminar, dejaría sin controles al jugador humano.
    if (this.useControls) {
      removeControlListeners();
      document.removeEventListener('keydown', this.keydownHandler);
    }
  }

  spawnPiece() {
    this.pieceId++;
    this.currentPiece = this.nextPiece;
    this.currentPiece.x = Math.floor(this.boardWidth / 2) - Math.ceil(this.currentPiece.shape[0].length / 2);
    this.currentPiece.y = 0;
    this.nextPiece = this.pieceSource();
    this.drawNextPiece();

    // Si no puede moverse en la posición inicial => Game Over
    if (!this.canMove(0, 0, this.currentPiece.shape)) {
      this.gameOver();
    }
  }

  // Devuelve el estado del juego para la IA
  getGameState() {
    return {
      board: this.board.grid.map(row => row.map(cell => (cell ? 1 : 0))),
      currentPiece: {
        type: this.currentPiece.type,
        // La IA necesita la matriz real de la pieza para simular jugadas.
        shape: this.currentPiece.shape.map(row => [...row]),
        position: { x: this.currentPiece.x, y: this.currentPiece.y }
      },
      nextPiece: { type: this.nextPiece.type },
      pieceId: this.pieceId
    };
  }

  // Ejecuta la acción indicada por la IA
  executeAction(action) {
    if (!this.isAIPlaying) return; // Evita que la IA actúe si no está activada

    switch (action) {
      case 0: // No hacer nada (o mover hacia abajo)
        this.movePiece(0, 1);
        break;
      case 1: // Mover a la izquierda
        this.movePiece(-1, 0);
        break;
      case 2: // Mover a la derecha
        this.movePiece(1, 0);
        break;
      case 3: // Rotar
        this.rotatePiece();
        break;
      case 4: // Hard drop
        this.hardDrop();
        break;
      default:
        break;
    }
  }

  handleKeyDown(e) {
    // Bloquea el control manual si la IA está activa
    if (this.isAIPlaying) return;
    if (!this.currentPiece) return;

    switch (e.key) {
      case 'ArrowLeft':
        this.movePiece(-1, 0);
        break;
      case 'ArrowRight':
        this.movePiece(1, 0);
        break;
      case 'ArrowDown':
        this.softDrop();
        break;
      case ' ':
        e.preventDefault();
        this.hardDrop();
        break;
      case 'ArrowUp':
        this.rotatePiece();
        break;
      default:
        break;
    }
  }

  movePiece(dx, dy) {
    if (this.canMove(dx, dy, this.currentPiece.shape)) {
      this.currentPiece.x += dx;
      this.currentPiece.y += dy;
    } else if (dy > 0) {
      this.lockAndAdvance();
    }
    this.draw();
  }

  hardDrop() {
    let cellsMoved = 0;
    while (this.canMove(0, 1, this.currentPiece.shape)) {
      this.currentPiece.y += 1;
      cellsMoved++;
    }
    // Bonus por hard drop
    this.score += cellsMoved * 2;
    this.lockAndAdvance();
    this.draw();
  }

  softDrop() {
    if (this.canMove(0, 1, this.currentPiece.shape)) {
      this.currentPiece.y += 1;
      this.score += 1;
      this.draw();
    }
  }

  rotatePiece() {
    const rotated = this.rotateMatrix(this.currentPiece.shape);
    // Wall kicks
    if (this.canMove(0, 0, rotated)) {
      this.currentPiece.shape = rotated;
    } else if (this.canMove(-1, 0, rotated)) {
      this.currentPiece.x -= 1;
      this.currentPiece.shape = rotated;
    } else if (this.canMove(1, 0, rotated)) {
      this.currentPiece.x += 1;
      this.currentPiece.shape = rotated;
    }
    this.draw();
  }

  rotateMatrix(matrix) {
    // Gira 90° en sentido horario
    return matrix[0].map((_, index) =>
      matrix.map(row => row[index]).reverse()
    );
  }

  canMove(dx, dy, shape) {
    const { x, y } = this.currentPiece;
    // Board.canMove espera (piece, dx, dy): construimos una pieza-candidata
    // con la forma indicada (que puede ser una rotación aún no aplicada).
    return this.board.canMove({ x, y, shape }, dx, dy);
  }

  lockPiece() {
    this.board.lockPiece(this.currentPiece);
  }

  checkLines() {
    const fullLines = this.board.getFullLines();
    if (fullLines.length === 0) {
      this.updateScore();
      return 0;
    }

    // El borrado es ATÓMICO: se aplica al modelo de inmediato y la animación
    // queda como mera decoración. Diferirlo 600 ms dejaba el tablero
    // desincronizado (la IA planificaba sobre líneas ya completadas) y, peor
    // aún, la gravedad seguía corriendo durante la animación y fijaba piezas
    // sin que nadie las controlase.
    this.board.clearLines(fullLines);
    this.score += fullLines.length * 10;
    this.updateSpeed();
    this.updateScore();
    animateLineClear(this.boardElement, fullLines, () => {});

    let ataque = ATTACK_TABLE[Math.min(fullLines.length, ATTACK_TABLE.length - 1)];

    // Back-to-back: dos Tetris seguidos, sin ninguna otra jugada en medio.
    const esTetris = fullLines.length === 4;
    if (esTetris && this.lastClearWasTetris) ataque += BACK_TO_BACK_BONUS;
    this.lastClearWasTetris = esTetris;

    // Combo: cada pieza consecutiva que despeja suma al contador.
    this.combo++;
    if (this.combo > 0) {
      ataque += COMBO_TABLE[Math.min(this.combo, COMBO_TABLE.length - 1)];
    }

    // Perfect clear: dejar el tablero completamente vacío.
    if (this.board.isEmpty()) ataque += PERFECT_CLEAR_GARBAGE;

    // Antes de atacar se cancela la basura propia pendiente: defenderse tiene
    // prioridad sobre atacar, y sólo el sobrante llega al rival.
    const cancelado = Math.min(ataque, this.pendingGarbage);
    this.pendingGarbage -= cancelado;
    ataque -= cancelado;

    if (ataque > 0 && this.onAttack) this.onAttack(ataque);
    this.updateGarbageDisplay();
    return fullLines.length;
  }

  /** Encola basura enviada por el rival. */
  receiveGarbage(lines) {
    this.pendingGarbage += lines;
    this.updateGarbageDisplay();
  }

  /** Vuelca la basura pendiente al tablero. */
  applyPendingGarbage() {
    if (this.pendingGarbage <= 0) return;

    const overflow = this.board.addGarbage(
      this.pendingGarbage,
      this.buildGarbageHoles(this.pendingGarbage)
    );
    this.pendingGarbage = 0;
    this.updateGarbageDisplay();

    if (overflow) this.gameOver();
  }

  /**
   * Decide la columna del hueco de cada fila de basura. Las filas tienden a
   * repetir hueco (para que una I las despeje de golpe), pero no siempre: con
   * alineación total el intercambio degenera en un vaivén sin control.
   */
  buildGarbageHoles(count) {
    const huecos = [];
    let actual = Math.floor(this.random() * this.boardWidth);

    for (let i = 0; i < count; i++) {
      if (i > 0 && this.random() >= GARBAGE_ALIGNMENT) {
        actual = Math.floor(this.random() * this.boardWidth);
      }
      huecos.push(actual);
    }
    return huecos;
  }

  updateGarbageDisplay() {
    if (this.garbageDisplay) {
      this.garbageDisplay.textContent = this.pendingGarbage > 0 ? `⬆ ${this.pendingGarbage}` : '';
    }
  }

  /** Fija la pieza, resuelve líneas y basura, y saca la siguiente. */
  lockAndAdvance() {
    this.lockPiece();
    const despejadas = this.checkLines();
    if (despejadas === 0) {
      this.combo = -1; // combo roto: la pieza no despejó nada
      // La basura entra sólo si no se han despejado líneas.
      this.applyPendingGarbage();
    }
    if (this.isRunning) this.spawnPiece();
  }

  updateScore() {
    if (this.scoreDisplay) this.scoreDisplay.textContent = this.score;
  }

  updateSpeed() {
    const levelUp = Math.floor(this.score / 100);
    this.level = 1 + levelUp;
    if (this.levelDisplay) this.levelDisplay.textContent = this.level;

    // Ajustar la velocidad de descenso
    clearInterval(this.interval);
    this.interval = setInterval(() => this.movePiece(0, 1),
      Math.max(100, this.gravity - this.level * 50));
  }

  draw() {
    this.board.draw();
    this.drawGhostPiece();
    this.board.drawPiece(this.currentPiece);
  }

  drawGhostPiece() {
    const ghostY = this.getGhostPosition();
    this.board.drawGhost(this.currentPiece, ghostY);
  }

  getGhostPosition() {
    let ghostY = this.currentPiece.y;
    while (this.canMove(0, ghostY - this.currentPiece.y + 1, this.currentPiece.shape)) {
      ghostY++;
    }
    return ghostY;
  }

  gameOver() {
    this.stop();

    // En el modo versus decide quien orquesta la partida.
    if (this.onGameOver) {
      this.onGameOver(this);
      return;
    }

    // Si la IA está activa, reiniciar para seguir entrenando
    if (this.isAIPlaying) {
      this.resetGame();
    } else {
      alert('Game Over!');
      if (this.startButton) this.startButton.disabled = false;
    }
  }

  resetGame() {
    this.score = 0;
    this.level = 1;
    this.pendingGarbage = 0;
    this.combo = -1;
    this.lastClearWasTetris = false;
    this.board.clear();
    this.spawnPiece();
    this.start();
  }
  drawNextPiece() {
    if (!this.nextPieceBoard) return;
    // Clear the next piece board
    while (this.nextPieceBoard.firstChild) {
      this.nextPieceBoard.removeChild(this.nextPieceBoard.firstChild);
    }

    // Draw the next piece
    this.nextPiece.shape.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value) {
          const cell = document.createElement('div');
          cell.style.backgroundColor = this.nextPiece.color;
          cell.style.gridRowStart = rowIndex + 1;
          cell.style.gridColumnStart = colIndex + 1;
          this.nextPieceBoard.appendChild(cell);
        }
      });
    });
  }
}
