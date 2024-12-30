import Board from './Board.js';
import { getRandomPiece, animateLineClear } from './Utils.js';
import { addControlListeners, removeControlListeners } from './Controls.js';

export default class Game {
  constructor(gravity) {
    this.boardElement = document.getElementById('board');
    this.scoreDisplay = document.getElementById('score');
    this.levelDisplay = document.getElementById('level');
    this.nextPieceBoard = document.getElementById('nextPiece');
    this.startButton = document.getElementById('startButton');

    this.boardWidth = 10;
    this.boardHeight = 20;
    this.score = 0;
    this.level = 1;
    this.gravity = gravity;
    this.interval = null;

    this.board = new Board(this.boardWidth, this.boardHeight, this.boardElement);
    this.currentPiece = null;
    this.nextPiece = getRandomPiece();

    // Flags IA / Estado del juego
    this.isAIPlaying = false;
    this.isRunning = false;

    this.keydownHandler = this.handleKeyDown.bind(this);
    addControlListeners(this);
    document.addEventListener('keydown', this.keydownHandler);
  }

  start() {
    this.isRunning = true;
    this.startButton.disabled = true;
    this.spawnPiece();
    this.draw();
    this.interval = setInterval(() => this.movePiece(0, 1), this.gravity);
  }

  stop() {
    clearInterval(this.interval);
    this.isRunning = false;
    removeControlListeners();
    document.removeEventListener('keydown', this.keydownHandler);
  }

  spawnPiece() {
    this.currentPiece = this.nextPiece;
    this.currentPiece.x = Math.floor(this.boardWidth / 2) - Math.ceil(this.currentPiece.shape[0].length / 2);
    this.currentPiece.y = 0;
    this.nextPiece = getRandomPiece();
    this.drawNextPiece();

    // Si no puede moverse en la posición inicial => Game Over
    if (!this.canMove(0, 0, this.currentPiece.shape)) {
      this.gameOver();
    }
  }

  // Devuelve el estado del juego para la IA
  getGameState() {
    return {
      board: this.board.grid.map(row => row.map(cell => (cell ? cell.type : 0))),
      currentPiece: {
        type: this.currentPiece.type,
        rotation: this.currentPiece.rotation,
        position: { x: this.currentPiece.x, y: this.currentPiece.y }
      },
      nextPiece: { type: this.nextPiece.type }
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
    return this.board.canMove(x + dx, y + dy, shape);
  }

  lockPiece() {
    this.board.lockPiece(this.currentPiece);
  }

  checkLines() {
    const fullLines = this.board.getFullLines();
    if (fullLines.length > 0) {
      animateLineClear(this.boardElement, fullLines, () => {
        this.board.clearLines(fullLines);
        this.score += fullLines.length * 10;
        this.updateSpeed();
        this.updateScore();
      });
    } else {
      this.updateScore();
    }
  }

  updateScore() {
    this.scoreDisplay.textContent = this.score;
  }

  updateSpeed() {
    const levelUp = Math.floor(this.score / 100);
    this.level = 1 + levelUp;
    this.levelDisplay.textContent = this.level;

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
    // Si la IA está activa, reiniciar para seguir entrenando
    if (this.isAIPlaying) {
      this.resetGame();
    } else {
      alert('Game Over!');
      this.startButton.disabled = false;
    }
  }

  resetGame() {
    this.score = 0;
    this.level = 1;
    this.board.clear();
    this.spawnPiece();
    this.start();
  }
}
