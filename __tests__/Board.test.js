import Board from '../modules/Board.js';

describe('Board', () => {
  let board;
  let element;

  beforeEach(() => {
    element = document.createElement('div');
    board = new Board(10, 20, element);
  });

  test('should initialize with correct width and height', () => {
    expect(board.width).toBe(10);
    expect(board.height).toBe(20);
  });

  test('should create a grid with the correct dimensions', () => {
    expect(board.grid.length).toBe(20);
    expect(board.grid[0].length).toBe(10);
  });

  test('should create the correct number of cells in the DOM', () => {
    expect(element.children.length).toBe(200);
  });

  test('canMove should return true for a valid move', () => {
    const piece = { shape: [[1]], x: 0, y: 0 };
    expect(board.canMove(piece, 1, 0)).toBe(true);
  });

  test('canMove should return false for an invalid move', () => {
    const piece = { shape: [[1]], x: 9, y: 0 };
    expect(board.canMove(piece, 1, 0)).toBe(false);
  });

  test('lockPiece should lock the piece on the board', () => {
    const piece = { shape: [[1]], x: 0, y: 0, color: 'red' };
    board.lockPiece(piece);
    expect(board.grid[0][0]).toBe(1); // Usar valores numéricos
  });

  test('getFullLines should return the indices of full lines', () => {
    board.grid[0] = new Array(10).fill(1);
    expect(board.getFullLines()).toEqual([0]);
  });

  test('clearLines should clear the specified lines', () => {
    board.grid[0] = new Array(10).fill(1);
    board.clearLines([0]);
    expect(board.grid[0]).toEqual(new Array(10).fill(0));
  });

  test('draw should update the DOM with the correct colors', () => {
    board.grid[0][0] = 1;
    board.draw();
    expect(element.children[0].style.backgroundColor).toBe('red');
  });

  test('drawPiece should draw the piece on the board', () => {
    const piece = { shape: [[1]], x: 0, y: 0, color: 'red' }; // Incluir el color
    board.drawPiece(piece);
    expect(element.children[0].style.backgroundColor).toBe('red');
  });

  test('drawGhost should draw the ghost piece on the board', () => {
    const piece = { shape: [[1]], x: 0, y: 0 };
    const ghostY = 5; // Posición de la sombra
    board.drawGhost(piece, ghostY); // Proporcionar ghostY
    const index = ghostY * board.width + piece.x; // Índice calculado para verificar
    expect(element.children[index].style.backgroundColor).toBe('rgba(255, 0, 0, 0.5)');
  });
});
