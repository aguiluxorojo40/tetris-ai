import {
  getRandomPiece,
  animateLineClear,
  createRandom,
  createPieceSequence,
  createPieceReader,
  shuffledBag,
} from '../modules/Utils.js';
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

describe('secuencia compartida de piezas', () => {
  test('la misma semilla produce siempre la misma secuencia', () => {
    const a = createPieceSequence(42);
    const b = createPieceSequence(42);
    for (let i = 0; i < 50; i++) {
      expect(a(i).type).toBe(b(i).type);
    }
  });

  test('semillas distintas producen secuencias distintas', () => {
    const a = createPieceSequence(1);
    const b = createPieceSequence(2);
    const serieA = Array.from({ length: 30 }, (_, i) => a(i).type).join('');
    const serieB = Array.from({ length: 30 }, (_, i) => b(i).type).join('');
    expect(serieA).not.toBe(serieB);
  });

  // Es la garantía de que el duelo es justo: ambos reciben idénticas piezas.
  test('dos lectores independientes reciben las mismas piezas en el mismo orden', () => {
    const sequence = createPieceSequence(2024);
    const jugador = createPieceReader(sequence);
    const rival = createPieceReader(sequence);

    for (let i = 0; i < 40; i++) {
      expect(jugador().type).toBe(rival().type);
    }
  });

  test('un lector avanza sin afectar al otro', () => {
    const sequence = createPieceSequence(7);
    const jugador = createPieceReader(sequence);
    const rival = createPieceReader(sequence);

    const primeras = [jugador().type, jugador().type, jugador().type];
    // El rival, que va por detrás, debe recibir exactamente esas mismas piezas.
    expect([rival().type, rival().type, rival().type]).toEqual(primeras);
  });

  test('las piezas de la secuencia son independientes entre sí', () => {
    const sequence = createPieceSequence(99);
    const primera = sequence(0);
    primera.shape[0][0] = 9;
    expect(sequence(0).shape.flat()).not.toContain(9);
  });

  test('createRandom es determinista y devuelve valores en [0, 1)', () => {
    const a = createRandom(123);
    const b = createRandom(123);
    for (let i = 0; i < 20; i++) {
      const valor = a();
      expect(valor).toBe(b());
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(1);
    }
  });
});

describe('bolsa de 7 piezas (Random Generator del Guideline)', () => {
  const TIPOS = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];

  test('shuffledBag devuelve los 7 índices sin repetir', () => {
    const bag = shuffledBag(Math.random);
    expect(bag).toHaveLength(7);
    expect(new Set(bag).size).toBe(7);
  });

  // Lo que evita la bolsa: con azar uniforme puedes pasarte veinte piezas sin
  // ver una I, y en un duelo eso decide la partida.
  test('cada tanda de 7 reparte todas las piezas una vez', () => {
    const sequence = createPieceSequence(7);
    for (let tanda = 0; tanda < 5; tanda++) {
      const tipos = Array.from({ length: 7 }, (_, i) => sequence(tanda * 7 + i).type);
      expect(new Set(tipos).size).toBe(7);
      expect(new Set(tipos)).toEqual(new Set(TIPOS));
    }
  });

  test('la espera entre dos piezas iguales nunca pasa de 12', () => {
    const sequence = createPieceSequence(123);
    const tipos = Array.from({ length: 350 }, (_, i) => sequence(i).type);

    let maxEspera = 0;
    for (const tipo of TIPOS) {
      let anterior = -1;
      tipos.forEach((t, i) => {
        if (t !== tipo) return;
        if (anterior >= 0) maxEspera = Math.max(maxEspera, i - anterior);
        anterior = i;
      });
    }
    // Peor caso teórico de la bolsa: última de una tanda y primera de la
    // siguiente-siguiente, es decir 12 piezas de separación.
    expect(maxEspera).toBeLessThanOrEqual(12);
  });

  test('getRandomPiece también reparte por tandas', () => {
    const tipos = Array.from({ length: 7 }, () => getRandomPiece().type);
    expect(new Set(tipos).size).toBe(7);
  });
});
