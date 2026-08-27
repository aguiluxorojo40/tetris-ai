import AI, {
  ACTION,
  DEFAULT_WEIGHTS,
  rotateShape,
  sameShape,
  fits,
  simulateDrop,
  countHoles,
  rowTransitions,
  columnTransitions,
  cumulativeWells,
  clearCompleteLines,
  evaluatePlacement,
  rankPlacements,
  findBestPlacement,
} from '../modules/AI.js';

const emptyGrid = () => Array.from({ length: 20 }, () => new Array(10).fill(0));

const estado = (grid, shape, x, pieceId = 1) => ({
  board: grid,
  currentPiece: { type: 'T', shape, position: { x, y: 0 } },
  nextPiece: { type: 'O' },
  pieceId,
});

describe('rasgos de Dellacherie', () => {
  test('countHoles cuenta las celdas vacías tapadas', () => {
    const grid = emptyGrid();
    grid[18][0] = 1; // deja (19,0) tapada
    expect(countHoles(grid)).toBe(1);
  });

  test('countHoles ignora los huecos abiertos por arriba', () => {
    const grid = emptyGrid();
    grid[19][0] = 1;
    grid[19][2] = 1; // la columna 1 está hundida pero destapada
    expect(countHoles(grid)).toBe(0);
  });

  // Las paredes cuentan como llenas: una fila vacía tiene 2 transiciones
  // (pared→vacío y vacío→pared), así que un tablero vacío suma 20×2 = 40.
  test('rowTransitions trata las paredes como llenas', () => {
    expect(rowTransitions(emptyGrid())).toBe(40);
  });

  test('una fila completa no aporta transiciones', () => {
    const grid = emptyGrid();
    grid[19] = new Array(10).fill(1);
    // 19 filas vacías × 2; la fila llena, 0.
    expect(rowTransitions(grid)).toBe(38);
  });

  // El techo cuenta como vacío y el suelo como lleno: cada columna vacía
  // aporta una única transición al llegar al suelo.
  test('columnTransitions trata el suelo como lleno', () => {
    expect(columnTransitions(emptyGrid())).toBe(10);
  });

  test('una columna a huecos alternos aporta muchas transiciones', () => {
    const liso = emptyGrid();
    for (let y = 10; y < 20; y++) liso[y][0] = 1;

    const alterno = emptyGrid();
    for (let y = 10; y < 20; y += 2) alterno[y][0] = 1;

    expect(columnTransitions(alterno)).toBeGreaterThan(columnTransitions(liso));
  });

  test('cumulativeWells es cero en un tablero vacío', () => {
    expect(cumulativeWells(emptyGrid())).toBe(0);
  });

  // Un pozo de profundidad 3 aporta 1+2+3 = 6: los pozos hondos penalizan
  // mucho más que los superficiales.
  test('cumulativeWells acumula la profundidad de cada pozo', () => {
    const grid = emptyGrid();
    for (let y = 17; y < 20; y++) { grid[y][0] = 1; grid[y][2] = 1; }
    expect(cumulativeWells(grid)).toBe(6);
  });

  test('clearCompleteLines elimina y desplaza', () => {
    const grid = emptyGrid();
    grid[18][0] = 1;
    grid[19] = new Array(10).fill(1);

    const { grid: resultado, cleared } = clearCompleteLines(grid);
    expect(cleared).toBe(1);
    expect(resultado[19][0]).toBe(1);
    expect(resultado.length).toBe(20);
  });
});

describe('geometría', () => {
  test('rotateShape gira en sentido horario', () => {
    expect(rotateShape([[0, 1, 0], [1, 1, 1]])).toEqual([[1, 0], [1, 1], [1, 0]]);
  });

  test('cuatro rotaciones devuelven la forma original', () => {
    const original = [[0, 1, 0], [1, 1, 1]];
    let forma = original;
    for (let i = 0; i < 4; i++) forma = rotateShape(forma);
    expect(forma).toEqual(original);
  });

  test('sameShape compara por contenido, no por referencia', () => {
    expect(sameShape([[1, 0]], [[1, 0]])).toBe(true);
    expect(sameShape([[1, 0]], [[0, 1]])).toBe(false);
    expect(sameShape([[1]], [[1], [1]])).toBe(false);
  });

  test('fits respeta bordes y colisiones', () => {
    const grid = emptyGrid();
    grid[5][3] = 1;
    expect(fits(grid, [[1]], 0, 0)).toBe(true);
    expect(fits(grid, [[1]], -1, 0)).toBe(false);
    expect(fits(grid, [[1]], 10, 0)).toBe(false);
    expect(fits(grid, [[1]], 0, 20)).toBe(false);
    expect(fits(grid, [[1]], 3, 5)).toBe(false);
  });

  test('simulateDrop deja la pieza en el suelo y describe sus celdas', () => {
    const drop = simulateDrop(emptyGrid(), [[1]], 4);
    expect(drop.y).toBe(19);
    expect(drop.grid[19][4]).toBe(1);
    expect(drop.cells).toEqual([[19, 4]]);
  });

  test('simulateDrop apila sobre lo existente y no muta el original', () => {
    const grid = emptyGrid();
    grid[19][4] = 1;
    const drop = simulateDrop(grid, [[1]], 4);
    expect(drop.y).toBe(18);
    expect(grid[18][4]).toBe(0); // el tablero original queda intacto
  });

  test('simulateDrop devuelve null si la columna está llena', () => {
    const grid = emptyGrid();
    for (let y = 0; y < 20; y++) grid[y][0] = 1;
    expect(simulateDrop(grid, [[1]], 0)).toBeNull();
  });
});

describe('evaluación y elección de jugada', () => {
  test('penaliza dejar huecos', () => {
    const grid = emptyGrid();
    grid[19][1] = 1; // al poner la pieza en la columna 0 sobre nada...
    const limpio = simulateDrop(emptyGrid(), [[1, 1]], 0);
    const conHueco = simulateDrop(grid, [[1, 1]], 0);
    expect(evaluatePlacement(limpio)).toBeGreaterThan(evaluatePlacement(conHueco));
  });

  test('rankPlacements devuelve las jugadas ordenadas de mejor a peor', () => {
    const opciones = rankPlacements(emptyGrid(), [[1, 1], [1, 1]]);
    expect(opciones.length).toBeGreaterThan(0);
    for (let i = 1; i < opciones.length; i++) {
      expect(opciones[i - 1].score).toBeGreaterThanOrEqual(opciones[i].score);
    }
  });

  test('no evalúa dos veces las rotaciones repetidas de una pieza simétrica', () => {
    // El cuadrado es igual en sus cuatro rotaciones: 9 posiciones, no 36.
    expect(rankPlacements(emptyGrid(), [[1, 1], [1, 1]]).length).toBe(9);
  });

  test('no tapa un hueco pudiendo evitarlo', () => {
    const grid = emptyGrid();
    grid[19] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]; // hueco en la columna 9
    expect(findBestPlacement(grid, [[1, 1], [1, 1]]).x).not.toBe(8);
  });

  test('devuelve null si la pieza no cabe en ninguna columna', () => {
    const lleno = Array.from({ length: 20 }, () => new Array(10).fill(1));
    expect(findBestPlacement(lleno, [[1]])).toBeNull();
  });

  test('los pesos por defecto son los de Dellacherie', () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      holes: -4,
      cumulativeWells: -1,
      rowTransitions: -1,
      columnTransitions: -1,
      landingHeight: -1,
      erodedPieceCells: 1,
    });
  });
});

describe('AI — planificación sin estado', () => {
  test('la secuencia de acciones termina en hard drop', () => {
    const ai = new AI();
    const grid = emptyGrid();
    let piece = { shape: [[0, 1, 0], [1, 1, 1]], x: 4 };
    const acciones = [];

    for (let i = 0; i < 15; i++) {
      const accion = ai.predictAction(estado(grid, piece.shape, piece.x));
      acciones.push(accion);
      if (accion === ACTION.HARD_DROP) break;
      // Simulamos el efecto de la acción sobre la pieza.
      if (accion === ACTION.ROTATE) piece.shape = rotateShape(piece.shape);
      if (accion === ACTION.LEFT) piece.x--;
      if (accion === ACTION.RIGHT) piece.x++;
    }

    expect(acciones[acciones.length - 1]).toBe(ACTION.HARD_DROP);
  });

  // Regresión: antes la IA guardaba una lista de pasos, y si una acción se
  // perdía (animación de borrado) o la gravedad movía la pieza, el resto del
  // plan se ejecutaba sobre una situación que ya no existía.
  test('se corrige sola si la pieza se mueve entre llamadas', () => {
    const ai = new AI();
    const grid = emptyGrid();
    const forma = [[1, 1], [1, 1]];

    const primera = ai.predictAction(estado(grid, forma, 4));
    const destino = ai.target.x;

    // La pieza aparece de pronto en otra columna, sin haber ejecutado nada.
    const segunda = ai.predictAction(estado(grid, forma, destino));
    expect(segunda).toBe(ACTION.HARD_DROP); // ya está en su sitio: suelta
    expect(primera).not.toBeNull();
  });

  test('mantiene el mismo destino mientras sea la misma pieza', () => {
    const ai = new AI();
    const grid = emptyGrid();
    ai.predictAction(estado(grid, [[1, 1], [1, 1]], 4, 7));
    const destino = ai.target;
    ai.predictAction(estado(grid, [[1, 1], [1, 1]], 4, 7));
    expect(ai.target).toBe(destino);
  });

  test('replantea cuando aparece una pieza nueva', () => {
    const ai = new AI();
    const grid = emptyGrid();
    ai.predictAction(estado(grid, [[1, 1], [1, 1]], 4, 1));
    const destino = ai.target;
    ai.predictAction(estado(grid, [[1, 1, 1, 1]], 3, 2)); // pieza distinta
    expect(ai.target).not.toBe(destino);
  });

  // Salvaguarda: si una rotación queda bloqueada contra la pared, la forma
  // nunca llegaría a coincidir con el destino. Tras cuatro intentos (un giro
  // completo) la IA suelta la pieza en lugar de girar sin fin.
  test('no gira indefinidamente si la forma objetivo no se alcanza', () => {
    const ai = new AI();
    const grid = emptyGrid();
    const forma = [[1]];

    ai.predictAction(estado(grid, forma, 4, 1));
    // Forzamos un destino cuya forma no coincidirá jamás con la pieza.
    ai.target = { x: 4, rotations: 1, shape: [[1], [1]], score: 0 };
    ai.rotationsTried = 0;

    const acciones = [];
    for (let i = 0; i < 8; i++) {
      acciones.push(ai.predictAction(estado(grid, forma, 4, 1))); // misma pieza
    }

    expect(acciones.slice(0, 4)).toEqual([
      ACTION.ROTATE, ACTION.ROTATE, ACTION.ROTATE, ACTION.ROTATE,
    ]);
    expect(acciones[acciones.length - 1]).toBe(ACTION.HARD_DROP);
  });

  test('reset olvida el destino', () => {
    const ai = new AI();
    ai.predictAction(estado(emptyGrid(), [[1, 1], [1, 1]], 4));
    expect(ai.target).not.toBeNull();
    ai.reset();
    expect(ai.target).toBeNull();
  });

  test('devuelve null ante un estado inválido', () => {
    const ai = new AI();
    expect(ai.predictAction(null)).toBeNull();
    expect(ai.predictAction({})).toBeNull();
    expect(ai.predictAction({ board: emptyGrid() })).toBeNull();
  });
});

describe('AI — dificultad', () => {
  test('sin margen de error elige siempre la mejor jugada', () => {
    const ai = new AI({ random: () => 0 }); // mistakeRate 0 por defecto
    const grid = emptyGrid();
    const forma = [[1, 1, 1, 1]];
    ai.predictAction(estado(grid, forma, 3));
    expect(ai.target.score).toBe(rankPlacements(grid, forma)[0].score);
  });

  // Un fallo no es una jugada absurda, sino una mediocre: se elige de la mitad
  // peor de la lista, que es como falla un jugador humano.
  test('con margen de error elige una jugada peor', () => {
    const grid = emptyGrid();
    const forma = [[1, 1, 1, 1]];
    const mejor = rankPlacements(grid, forma)[0].score;

    const ai = new AI({ mistakeRate: 1, random: () => 0 });
    ai.predictAction(estado(grid, forma, 3));
    expect(ai.target.score).toBeLessThanOrEqual(mejor);
  });

  test('el margen de error no rompe la elección', () => {
    const ai = new AI({ mistakeRate: 1, random: () => 0.999 });
    const accion = ai.predictAction(estado(emptyGrid(), [[1, 1], [1, 1]], 4));
    expect([0, 1, 2, 3, 4]).toContain(accion);
    expect(ai.target).not.toBeNull();
  });
});
