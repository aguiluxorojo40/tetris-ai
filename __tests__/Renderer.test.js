import Board from '../modules/Board.js';
import DomRenderer, {
  EMPTY_COLOR,
  GARBAGE_COLOR,
  GHOST_COLOR,
} from '../modules/renderers/DomRenderer.js';

// Renderizador de mentira: sirve para comprobar que Board delega, sin
// depender de WebGL (que jsdom no tiene). El de verdad se verifica en el
// navegador.
function fakeRenderer() {
  return {
    init: jest.fn(),
    drawCells: jest.fn(),
    drawPiece: jest.fn(),
    drawGhost: jest.fn(),
    dispose: jest.fn(),
  };
}

describe('Board — abstracción del renderizador', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
  });

  test('por defecto usa la rejilla de divs', () => {
    const board = new Board(10, 20, element);
    expect(board.renderer).toBeInstanceOf(DomRenderer);
    expect(element.children.length).toBe(200);
  });

  test('acepta un renderizador propio y lo inicializa', () => {
    const renderer = fakeRenderer();
    new Board(10, 20, element, renderer);
    expect(renderer.init).toHaveBeenCalledWith(element, 10, 20);
  });

  test('delega el dibujado en el renderizador', () => {
    const renderer = fakeRenderer();
    const board = new Board(10, 20, element, renderer);
    const piece = { shape: [[1]], x: 0, y: 0, color: 'red' };

    board.draw();
    board.drawPiece(piece);
    board.drawGhost(piece, 5);

    expect(renderer.drawCells).toHaveBeenCalledWith(board.grid);
    expect(renderer.drawPiece).toHaveBeenCalledWith(piece);
    expect(renderer.drawGhost).toHaveBeenCalledWith(piece, 5);
  });

  // Cambiar de 2D a 3D en mitad de una partida no puede perder el tablero.
  test('setRenderer conserva el estado y desecha el anterior', () => {
    const primero = fakeRenderer();
    const segundo = fakeRenderer();
    const board = new Board(10, 20, element, primero);
    board.grid[19][0] = '#00e5e5';

    board.setRenderer(segundo);

    expect(primero.dispose).toHaveBeenCalled();
    expect(segundo.init).toHaveBeenCalledWith(element, 10, 20);
    expect(board.renderer).toBe(segundo);
    expect(board.grid[19][0]).toBe('#00e5e5'); // el tablero sigue igual
  });
});

describe('DomRenderer', () => {
  let element;
  let renderer;

  beforeEach(() => {
    element = document.createElement('div');
    renderer = new DomRenderer();
    renderer.init(element, 10, 20);
  });

  test('init crea una celda por posición', () => {
    expect(element.children.length).toBe(200);
  });

  test('init parte de cero al reinicializar', () => {
    renderer.init(element, 10, 20);
    expect(element.children.length).toBe(200);
  });

  test('drawCells usa el color guardado y el de fondo para las vacías', () => {
    const grid = Array.from({ length: 20 }, () => new Array(10).fill(0));
    grid[0][0] = '#00e5e5';
    grid[0][1] = 1; // valor "lleno" sin color: se pinta como basura

    renderer.drawCells(grid);

    expect(element.children[0].style.backgroundColor).toBe('rgb(0, 229, 229)');
    expect(element.children[1].style.backgroundColor).toBe('rgb(138, 138, 138)');
    expect(element.children[2].style.backgroundColor).toBe('rgb(68, 68, 68)');
  });

  test('drawGhost usa el color de la sombra', () => {
    renderer.drawGhost({ shape: [[1]], x: 0 }, 5);
    expect(element.children[50].style.backgroundColor).toBe(GHOST_COLOR);
  });

  test('los colores exportados son los esperados', () => {
    expect(EMPTY_COLOR).toBe('#444');
    expect(GARBAGE_COLOR).toBe('#8a8a8a');
    expect(GHOST_COLOR).not.toMatch(/255,\s*0,\s*0/);
  });

  test('dispose vacía el tablero', () => {
    renderer.dispose();
    expect(element.children.length).toBe(0);
  });
});
