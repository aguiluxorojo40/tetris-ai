import Game from './Game.js';
import Board from './Board.js';
import { getRandomPiece } from './Utils.js';

jest.mock('./Board.js');
jest.mock('./Utils.js');

describe('Game', () => {
  let game;
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

    getRandomPiece.mockReturnValue({ type: 'I', shape: [[1], [1], [1], [1]] });

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
