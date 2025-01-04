import Game from '../modules/Game.js';
import Board from '../modules/Board.js';
import { Piece } from '../modules/Piece.js';

jest.mock('../modules/Board.js');
jest.mock('../modules/Piece.js');

describe('Game', () => {
  let game;
  let mockBoard;
  let mockPiece;

  beforeEach(() => {
    mockBoard = new Board(10, 20);
    game = new Game(mockBoard);
    mockPiece = new Piece([[1, 1], [1, 1]], 'yellow');
  });

  test('lockPiece should add piece shape to the grid at the correct position', () => {
    mockPiece.x = 4;
    mockPiece.y = 18;

    // Inicializar la grilla con ceros
    mockBoard.grid = Array.from({ length: 20 }, () => Array(10).fill(0));

    game.lockPiece(mockPiece);

    // Verificar que las celdas corresponden al shape del piece
    for (let row = 0; row < mockPiece.shape.length; row++) {
      for (let col = 0; col < mockPiece.shape[row].length; col++) {
        if (mockPiece.shape[row][col]) {
          expect(mockBoard.grid[mockPiece.y + row][mockPiece.x + col]).toBe(1);
        }
      }
    }
  });

  test('lockPiece should throw an error if piece is out of bounds', () => {
    mockPiece.x = 9; // Posición que causará desbordamiento en el grid
    mockPiece.y = 19;

    // Inicializar la grilla con ceros
    mockBoard.grid = Array.from({ length: 20 }, () => Array(10).fill(0));

    expect(() => {
      game.lockPiece(mockPiece);
    }).toThrow();
  });

  test('lockPiece should correctly update the grid with multiple pieces', () => {
    const piece1 = new Piece([[1, 1, 1]], 'purple');
    piece1.x = 3;
    piece1.y = 19;

    const piece2 = new Piece([[1], [1]], 'cyan');
    piece2.x = 5;
    piece2.y = 18;

    // Inicializar la grilla con ceros
    mockBoard.grid = Array.from({ length: 20 }, () => Array(10).fill(0));

    game.lockPiece(piece1);
    game.lockPiece(piece2);

    // Verificar pieza 1
    for (let col = 0; col < piece1.shape[0].length; col++) {
      expect(mockBoard.grid[piece1.y][piece1.x + col]).toBe(1);
    }

    // Verificar pieza 2
    for (let row = 0; row < piece2.shape.length; row++) {
      expect(mockBoard.grid[piece2.y + row][piece2.x]).toBe(1);
    }
  });

  let mockBoardElement;
  let mockScoreDisplay;
  let mockLevelDisplay;
  let mockNextPieceBoard;
  let mockStartButton;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="board"></div>
      <div id="score"></div>
      <div id="level"></div>
      <div id="nextPiece"></div>
      <button id="startButton"></button>
    `;

    mockBoardElement = document.getElementById('board');
    mockScoreDisplay = document.getElementById('score');
    mockLevelDisplay = document.getElementById('level');
    mockNextPieceBoard = document.getElementById('nextPiece');
    mockStartButton = document.getElementById('startButton');

    game = new Game(1000);
  });

  test('debería inicializar correctamente', () => {
    expect(game.boardElement).toBe(mockBoardElement);
    expect(game.scoreDisplay).toBe(mockScoreDisplay);
    expect(game.levelDisplay).toBe(mockLevelDisplay);
    expect(game.nextPieceBoard).toBe(mockNextPieceBoard);
    expect(game.startButton).toBe(mockStartButton);
    expect(game.boardWidth).toBe(10);
    expect(game.boardHeight).toBe(20);
    expect(game.score).toBe(0);
    expect(game.level).toBe(1);
    expect(game.gravity).toBe(1000);
    expect(game.interval).toBeNull();
    expect(game.board).toBeInstanceOf(Board);
    expect(game.currentPiece).toBeNull();
    expect(game.nextPiece).toEqual({ type: 'I', shape: [[1], [1], [1], [1]] });
    expect(game.isAIPlaying).toBe(false);
    expect(game.isRunning).toBe(false);
  });

  test('debería comenzar el juego correctamente', () => {
    game.start();
    expect(game.isRunning).toBe(true);
    expect(game.startButton.disabled).toBe(true);
    expect(game.currentPiece).not.toBeNull();
    expect(game.interval).not.toBeNull();
  });

  test('debería detener el juego correctamente', () => {
    game.start();
    game.stop();
    expect(game.isRunning).toBe(false);
    expect(game.interval).toBeNull();
  });

  test('debería mover la pieza correctamente', () => {
    game.spawnPiece();
    const initialX = game.currentPiece.x;
    const initialY = game.currentPiece.y;
    game.movePiece(1, 0);
    expect(game.currentPiece.x).toBe(initialX + 1);
    expect(game.currentPiece.y).toBe(initialY);
  });

  test('debería rotar la pieza correctamente', () => {
    game.spawnPiece();
    const initialShape = game.currentPiece.shape;
    game.rotatePiece();
    expect(game.currentPiece.shape).not.toBe(initialShape);
  });

  test('debería detectar líneas completas y actualizar la puntuación', () => {
    game.spawnPiece();
    game.board.getFullLines.mockReturnValue([0, 1]);
    game.checkLines();
    expect(game.score).toBe(20);
  });

  test('debería finalizar el juego cuando no se puede mover la pieza inicial', () => {
    game.canMove = jest.fn().mockReturnValue(false);
    game.spawnPiece();
    expect(game.isRunning).toBe(false);
  });
});

describe('Game', () => {
  let game;
  let element;

  beforeEach(() => {
    // Crear y agregar los botones necesarios al DOM
    document.body.innerHTML = `
      <button id="left"></button>
      <button id="right"></button>
      <button id="down"></button>
      <button id="hardDrop"></button>
    `;

    const left = document.getElementById('left');
    const right = document.getElementById('right');
    const down = document.getElementById('down');
    const hardDrop = document.getElementById('hardDrop');

    // Inicializar la instancia de Game con los elementos mockeados
    game = new Game(left, right, down, hardDrop);
  });

  test('should initialize game correctly', () => {
    expect(game).toBeDefined();
    // Agrega más expectativas según la implementación
  });

  // Otros tests...
});
