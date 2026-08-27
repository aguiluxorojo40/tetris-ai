// modules/Game.js
import Board from './Board.js';
import { getRandomPiece, animateLineClear } from './Utils.js';
import { addControlListeners, removeControlListeners } from './Controls.js';

// Elementos que usa un tablero por defecto. En el modo versus el segundo
// jugador recibe otros ids, para que ambas partidas sean independientes.
const DEFAULT_IDS = {
  board: 'board',
  score: 'score',
  level: 'level',
  nextPiece: 'nextPiece',
  startButton: 'startButton',
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
   */
  constructor(gravity, options = {}) {
    const ids = { ...DEFAULT_IDS, ...(options.ids || {}) };
    const byId = id => (id ? document.getElementById(id) : null);

    this.boardElement = byId(ids.board);
    this.scoreDisplay = byId(ids.score);
    this.levelDisplay = byId(ids.level);
    this.nextPieceBoard = byId(ids.nextPiece);
    this.startButton = byId(ids.startButton);

    this.pieceSource = options.pieceSource || getRandomPiece;
    this.onGameOver = options.onGameOver || null;
    this.useControls = options.controls !== false;

    this.boardWidth = 10;
    this.boardHeight = 20;
    this.score = 0;
    this.level = 1;
    this.gravity = gravity;
    this.interval = null;

    this.board = new Board(this.boardWidth, this.boardHeight, this.boardElement);
    this.currentPiece = null;
    this.nextPiece = this.pieceSource();

    // Flags IA / Estado del juego
    this.isAIPlaying = false;
    this.isRunning = false;
    // El borrado de líneas se anima durante 600 ms; mientras tanto la grilla
    // todavía contiene las líneas completas y la IA no debe seguir jugando
    // sobre un tablero desactualizado.
    this.isClearing = false;

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
      nextPiece: { type: this.nextPiece.type }
    };
  }

  // Ejecuta la acción indicada por la IA
  executeAction(action) {
    if (!this.isAIPlaying) return; // Evita que la IA actúe si no está activada
    if (this.isClearing) return;   // Espera a que termine el borrado de líneas

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
      // Bloquea la pieza
      this.lockPiece();
      this.checkLines();
      this.spawnPiece();
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
    this.lockPiece();
    this.checkLines();
    this.spawnPiece();
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
    if (fullLines.length > 0) {
      this.isClearing = true;
      animateLineClear(this.boardElement, fullLines, () => {
        this.board.clearLines(fullLines);
        this.score += fullLines.length * 10;
        this.updateSpeed();
        this.updateScore();
        this.isClearing = false;
      });
    } else {
      this.updateScore();
    }
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
    this.isClearing = false;
    this.board.clear();
    this.spawnPiece();
    this.start();
  }
  drawPiece(piece) {
    const { shape, x, y } = piece;
    shape.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value) {
          const cell = this.boardElement.children[(y + rowIndex) * this.boardWidth + (x + colIndex)];
          if (cell) cell.style.backgroundColor = 'red'; // Cambia según el color
        }
      });
    });
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
          cell.style.backgroundColor = 'red'; // Change according to the color
          cell.style.gridRowStart = rowIndex + 1;
          cell.style.gridColumnStart = colIndex + 1;
          this.nextPieceBoard.appendChild(cell);
        }
      });
    });
  }
}
