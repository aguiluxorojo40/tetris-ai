import Board from './Board';

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
    const shape = [
      [1, 1],
      [1, 1]
    ];
    expect(board.canMove(0, 0, shape)).toBe(true);
  });

  test('canMove should return false for an invalid move', () => {
    const shape = [
      [1, 1],
      [1, 1]
    ];
    expect(board.canMove(-1, 0, shape)).toBe(false);
  });

  test('lockPiece should lock the piece on the board', () => {
    const piece = { x: 0, y: 0, shape: [[1]], color: 'red' };
    board.lockPiece(piece);
    expect(board.grid[0][0]).toBe('red');
  });

  test('getFullLines should return the indices of full lines', () => {
    board.grid[0] = Array(10).fill('red');
    expect(board.getFullLines()).toEqual([0]);
  });

  test('clearLines should clear the specified lines', () => {
    board.grid[0] = Array(10).fill('red');
    board.clearLines([0]);
    expect(board.grid[0]).toEqual(Array(10).fill(0));
  });

  test('draw should update the DOM with the correct colors', () => {
    board.grid[0][0] = 'red';
    board.draw();
    expect(element.children[0].style.backgroundColor).toBe('red');
  });

  test('drawPiece should draw the piece on the board', () => {
    const piece = { x: 0, y: 0, shape: [[1]], color: 'red' };
    board.drawPiece(piece);
    expect(element.children[0].style.backgroundColor).toBe('red');
  });

  test('drawGhost should draw the ghost piece on the board', () => {
    const piece = { x: 0, y: 0, shape: [[1]] };
    board.drawGhost(piece, 1);
    expect(element.children[10].classList.contains('ghost')).toBe(true);
  });
});
