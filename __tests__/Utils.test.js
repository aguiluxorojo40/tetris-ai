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

  test('animateLineClear should add and remove line-clear class', (done) => {
    const boardElement = document.getElementById('board');

    // Crear celdas con la clase 'line-clear'
    for (let i = 0; i < 20; i++) { // Asumiendo 2 líneas de 10
      const row = document.createElement('div');
      row.classList.add('line-clear');
      boardElement.appendChild(row);
    }

    // Llamar a la función a probar con el callback done
    animateLineClear(boardElement, [0, 1], () => {
      const cellsAfterAnimation = boardElement.querySelectorAll('.line-clear');
      expect(cellsAfterAnimation.length).toBe(0);
      done();
    });

    // Avanzar el tiempo para simular la finalización de la animación
    jest.advanceTimersByTime(600);
  });
});
