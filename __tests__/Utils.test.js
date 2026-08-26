import { getRandomPiece, animateLineClear } from '../modules/Utils.js';
import { Piece } from '../modules/Piece.js';

describe('Utils module', () => {
  beforeAll(() => {
    // Configurar temporizadores simulados antes de todas las pruebas
    jest.useFakeTimers();
  });

  afterAll(() => {
    // Restaurar temporizadores reales después de todas las pruebas
    jest.useRealTimers();
  });

  beforeEach(() => {
    // Configurar el DOM antes de cada prueba
    document.body.innerHTML = '<div id="board"></div>';
  });

  afterEach(() => {
    // Limpiar el DOM y reiniciar mocks después de cada prueba
    document.body.innerHTML = '';
    jest.clearAllTimers();
  });

  test('getRandomPiece should return a Piece instance', () => {
    const piece = getRandomPiece();
    expect(piece).toBeInstanceOf(Piece);
  });

  test('getRandomPiece should always return a valid, well-formed piece', () => {
    const validTypes = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];
    for (let i = 0; i < 50; i++) {
      const piece = getRandomPiece();
      expect(validTypes).toContain(piece.type);
      expect(Array.isArray(piece.shape)).toBe(true);
      expect(piece.shape.length).toBeGreaterThan(0);
      expect(typeof piece.color).toBe('string');
    }
  });

  test('getRandomPiece should return independent shape copies', () => {
    const a = getRandomPiece();
    a.shape[0][0] = 9; // mutar una pieza no debe afectar a las siguientes
    const b = getRandomPiece();
    expect(b.shape.flat()).not.toContain(9);
  });

  test('animateLineClear should throw if callback is not a function', () => {
    const boardElement = document.getElementById('board');
    expect(() => animateLineClear(boardElement, [0], null)).toThrow(TypeError);
  });

  test('animateLineClear limpia sólo las líneas indicadas y avisa al terminar', () => {
    const boardElement = document.getElementById('board');

    // Crear celdas con la clase 'line-clear'
    for (let i = 0; i < 20; i++) {
      const row = document.createElement('div');
      row.classList.add('line-clear');
      boardElement.appendChild(row);
    }

    const callback = jest.fn();
    animateLineClear(boardElement, [0, 1], callback);

    // Durante la animación, las líneas afectadas quedan marcadas y el
    // callback todavía no se ha invocado.
    expect(boardElement.children[0].classList.contains('animating')).toBe(true);
    expect(boardElement.children[1].classList.contains('animating')).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(600);

    // Al terminar se limpian las líneas indicadas...
    expect(boardElement.children[0].classList.contains('line-clear')).toBe(false);
    expect(boardElement.children[1].classList.contains('line-clear')).toBe(false);
    expect(boardElement.children[0].classList.contains('animating')).toBe(false);
    // ...y sólo esas: el resto del tablero queda intacto.
    expect(boardElement.children[2].classList.contains('line-clear')).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
