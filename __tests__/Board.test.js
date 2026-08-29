import Board, { GARBAGE_COLOR, GHOST_COLOR } from '../modules/Board.js';

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

  test('canMove should return false when moving past the right wall', () => {
    const piece = { shape: [[1]], x: 9, y: 0 };
    expect(board.canMove(piece, 1, 0)).toBe(false);
  });

  test('canMove should return false when moving past the left wall', () => {
    const piece = { shape: [[1]], x: 0, y: 0 };
    expect(board.canMove(piece, -1, 0)).toBe(false);
  });

  test('canMove should return false when moving below the floor', () => {
    const piece = { shape: [[1]], x: 0, y: 19 };
    expect(board.canMove(piece, 0, 1)).toBe(false);
  });

  test('canMove should return false when colliding with a locked block', () => {
    board.grid[5][4] = 1;
    const piece = { shape: [[1]], x: 4, y: 4 };
    expect(board.canMove(piece, 0, 1)).toBe(false);
  });

  test('canMove should allow movement above the top of the board (y negativa)', () => {
    const piece = { shape: [[1, 1]], x: 4, y: -1 };
    expect(board.canMove(piece, 0, 0)).toBe(true);
  });

  // La grilla guarda el color de la pieza para que lo conserve al fijarse.
  test('lockPiece guarda el color de la pieza en la grilla', () => {
    const piece = { shape: [[1]], x: 0, y: 0, color: '#00e5e5' };
    board.lockPiece(piece);
    expect(board.grid[0][0]).toBe('#00e5e5');
  });

  test('lockPiece should lock every filled cell of a multi-cell piece', () => {
    const piece = { shape: [[1, 1], [0, 1]], x: 2, y: 3, color: '#e59000' };
    board.lockPiece(piece);
    expect(board.grid[3][2]).toBe('#e59000');
    expect(board.grid[3][3]).toBe('#e59000');
    expect(board.grid[4][3]).toBe('#e59000');
    expect(board.grid[4][2]).toBe(0); // celda vacía del shape
  });

  test('getFullLines should return the indices of full lines', () => {
    board.grid[0] = new Array(10).fill(1);
    expect(board.getFullLines()).toEqual([0]);
  });

  test('getFullLines should ignore partially filled rows', () => {
    board.grid[0] = new Array(10).fill(1);
    board.grid[0][5] = 0; // hueco
    expect(board.getFullLines()).toEqual([]);
  });

  test('clearLines should clear the specified lines', () => {
    board.grid[0] = new Array(10).fill(1);
    board.clearLines([0]);
    expect(board.grid[0]).toEqual(new Array(10).fill(0));
  });

  test('clearLines should shift rows above the cleared line downward', () => {
    // Marcador en la fila 18, línea completa en la 19.
    board.grid[18][0] = 1;
    board.grid[19] = new Array(10).fill(1);
    board.clearLines([19]);
    // El marcador desciende de la fila 18 a la 19.
    expect(board.grid[19][0]).toBe(1);
    expect(board.grid[18][0]).toBe(0);
  });

  // Regresión: draw() pintaba de rojo toda celda ocupada, así que la pieza
  // perdía su color en cuanto se posaba.
  test('draw pinta cada celda con el color que guarda la grilla', () => {
    board.lockPiece({ shape: [[1]], x: 0, y: 0, color: '#00e5e5' });
    board.lockPiece({ shape: [[1]], x: 1, y: 0, color: '#e59000' });
    board.draw();

    expect(element.children[0].style.backgroundColor).toBe('rgb(0, 229, 229)');
    expect(element.children[1].style.backgroundColor).toBe('rgb(229, 144, 0)');
    // Una celda vacía usa el color de fondo.
    expect(element.children[2].style.backgroundColor).toBe('rgb(68, 68, 68)');
  });

  test('drawPiece should draw the piece on the board', () => {
    const piece = { shape: [[1]], x: 0, y: 0, color: 'red' };
    board.drawPiece(piece);
    expect(element.children[0].style.backgroundColor).toBe('red');
  });

  test('drawGhost usa un color neutro, no el de ninguna pieza', () => {
    // Con las piezas ya coloreadas, un fantasma rojo se confundía con una Z.
    expect(GHOST_COLOR).not.toMatch(/255,\s*0,\s*0/);
  });

  test('drawGhost should draw the ghost piece on the board', () => {
    const piece = { shape: [[1]], x: 0, y: 0 };
    const ghostY = 5;
    board.drawGhost(piece, ghostY);
    const index = ghostY * board.width + piece.x;
    expect(element.children[index].style.backgroundColor).toBe(GHOST_COLOR);
  });
});

describe('Board.clear', () => {
  // Regresión: Game.resetGame() llamaba a board.clear() y el método no existía,
  // así que la partida reventaba al reiniciarse con la IA activa.
  test('vacía la grilla por completo', () => {
    const element = document.createElement('div');
    const board = new Board(10, 20, element);
    board.grid[19][0] = 1;
    board.grid[0][9] = 1;

    board.clear();

    expect(board.grid.length).toBe(20);
    expect(board.grid.every(row => row.length === 10 && row.every(c => c === 0))).toBe(true);
  });
});

describe('Board.addGarbage', () => {
  let board;

  beforeEach(() => {
    board = new Board(10, 20, document.createElement('div'));
  });

  test('inserta las filas por abajo con un único hueco', () => {
    board.addGarbage(2, 3);

    expect(board.grid[19].filter(c => c).length).toBe(9);
    expect(board.grid[19][3]).toBe(0);
    expect(board.grid[18][3]).toBe(0); // "basura limpia": mismo hueco
  });

  test('la basura se distingue en gris', () => {
    board.addGarbage(1, 3);
    expect(board.grid[19][0]).toBe(GARBAGE_COLOR);
  });

  test('empuja hacia arriba lo que ya había', () => {
    board.grid[19][0] = 1;
    board.addGarbage(1, 5);
    expect(board.grid[18][0]).toBe(1); // la marca sube una fila
  });

  test('avisa cuando la pila se sale por arriba', () => {
    expect(board.addGarbage(1, 5)).toBe(false);
    board.grid[0][0] = 1;
    expect(board.addGarbage(1, 5)).toBe(true);
  });

  test('mantiene las dimensiones del tablero', () => {
    board.addGarbage(4, 2);
    expect(board.grid.length).toBe(20);
    expect(board.grid.every(row => row.length === 10)).toBe(true);
  });
});
