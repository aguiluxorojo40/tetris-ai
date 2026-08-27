import AI, {
  ACTION,
  columnHeights,
  countHoles,
  bumpiness,
  clearCompleteLines,
  rotateShape,
  fits,
  dropShape,
  evaluateGrid,
  findBestPlacement,
  planActions,
} from '../modules/AI.js';

const emptyGrid = () => Array.from({ length: 20 }, () => new Array(10).fill(0));

describe('métricas del tablero', () => {
  test('columnHeights devuelve 0 en un tablero vacío', () => {
    expect(columnHeights(emptyGrid())).toEqual(new Array(10).fill(0));
  });

  test('columnHeights mide desde el bloque más alto de cada columna', () => {
    const grid = emptyGrid();
    grid[18][0] = 1; // altura 2
    grid[19][2] = 1; // altura 1
    expect(columnHeights(grid)).toEqual([2, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('countHoles cuenta las celdas vacías tapadas', () => {
    const grid = emptyGrid();
    grid[18][0] = 1; // deja la celda (19,0) tapada
    expect(countHoles(grid)).toBe(1);
  });

  test('countHoles ignora los huecos que siguen abiertos por arriba', () => {
    const grid = emptyGrid();
    grid[19][0] = 1;
    grid[19][2] = 1; // la columna 1 está hundida pero destapada
    expect(countHoles(grid)).toBe(0);
  });

  test('bumpiness suma los desniveles entre columnas contiguas', () => {
    expect(bumpiness([0, 3, 1])).toBe(5); // |0-3| + |3-1|
    expect(bumpiness([2, 2, 2])).toBe(0);
  });

  test('clearCompleteLines elimina las líneas llenas y desplaza el resto', () => {
    const grid = emptyGrid();
    grid[18][0] = 1;
    grid[19] = new Array(10).fill(1);

    const { grid: resultado, cleared } = clearCompleteLines(grid);
    expect(cleared).toBe(1);
    expect(resultado.length).toBe(20);
    expect(resultado[19][0]).toBe(1); // el bloque de la fila 18 baja a la 19
    expect(resultado[0].every(c => c === 0)).toBe(true);
  });
});

describe('geometría de las piezas', () => {
  test('rotateShape gira en sentido horario', () => {
    expect(rotateShape([[0, 1, 0], [1, 1, 1]])).toEqual([[1, 0], [1, 1], [1, 0]]);
  });

  test('cuatro rotaciones devuelven la forma original', () => {
    const original = [[0, 1, 0], [1, 1, 1]];
    let forma = original;
    for (let i = 0; i < 4; i++) forma = rotateShape(forma);
    expect(forma).toEqual(original);
  });

  test('fits respeta los bordes del tablero', () => {
    const grid = emptyGrid();
    expect(fits(grid, [[1]], 0, 0)).toBe(true);
    expect(fits(grid, [[1]], -1, 0)).toBe(false);  // fuera por la izquierda
    expect(fits(grid, [[1]], 10, 0)).toBe(false);  // fuera por la derecha
    expect(fits(grid, [[1]], 0, 20)).toBe(false);  // por debajo del suelo
  });

  test('fits detecta colisiones y permite estar por encima del tablero', () => {
    const grid = emptyGrid();
    grid[5][3] = 1;
    expect(fits(grid, [[1]], 3, 5)).toBe(false);
    expect(fits(grid, [[1, 1]], 4, -1)).toBe(true); // aún entrando por arriba
  });

  test('dropShape deja la pieza en el suelo', () => {
    const resultado = dropShape(emptyGrid(), [[1]], 4);
    expect(resultado[19][4]).toBe(1);
    expect(resultado[18][4]).toBe(0);
  });

  test('dropShape apila la pieza sobre los bloques existentes', () => {
    const grid = emptyGrid();
    grid[19][4] = 1;
    const resultado = dropShape(grid, [[1]], 4);
    expect(resultado[18][4]).toBe(1);
  });

  test('dropShape devuelve null si la columna está llena hasta arriba', () => {
    const grid = emptyGrid();
    for (let y = 0; y < 20; y++) grid[y][0] = 1;
    expect(dropShape(grid, [[1]], 0)).toBeNull();
  });

  test('dropShape no modifica el tablero original', () => {
    const grid = emptyGrid();
    dropShape(grid, [[1]], 4);
    expect(grid[19][4]).toBe(0);
  });
});

describe('evaluación de jugadas', () => {
  test('prefiere un tablero sin huecos', () => {
    const plano = emptyGrid();
    for (let x = 0; x < 4; x++) plano[19][x] = 1;

    const conHuecos = emptyGrid();
    for (let x = 0; x < 4; x++) conHuecos[18][x] = 1; // deja 4 huecos debajo

    expect(evaluateGrid(plano)).toBeGreaterThan(evaluateGrid(conHuecos));
  });

  test('prefiere completar una línea', () => {
    const completa = emptyGrid();
    completa[19] = new Array(10).fill(1);

    const incompleta = emptyGrid();
    incompleta[19] = new Array(10).fill(1);
    incompleta[19][9] = 0;

    expect(evaluateGrid(completa)).toBeGreaterThan(evaluateGrid(incompleta));
  });
});

describe('elección de jugada', () => {
  test('rota la pieza I y la encaja en el hueco para completar la línea', () => {
    const grid = emptyGrid();
    grid[19] = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // sólo falta la columna 0

    const jugada = findBestPlacement(grid, [[1, 1, 1, 1]]);
    expect(jugada.x).toBe(0);
    expect(jugada.rotations).toBe(1); // vertical
  });

  test('no tapa un hueco pudiendo evitarlo', () => {
    const grid = emptyGrid();
    grid[19] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]; // hueco en la columna 9

    const jugada = findBestPlacement(grid, [[1, 1], [1, 1]]);
    expect(jugada.x).not.toBe(8); // colocarla ahí taparía el hueco
  });

  test('devuelve null si la pieza no cabe en ninguna columna', () => {
    const lleno = Array.from({ length: 20 }, () => new Array(10).fill(1));
    expect(findBestPlacement(lleno, [[1]])).toBeNull();
  });

  test('planActions traduce la jugada en rotaciones, desplazamiento y hard drop', () => {
    expect(planActions({ rotations: 2, x: 1 }, 4)).toEqual([
      ACTION.ROTATE, ACTION.ROTATE,
      ACTION.LEFT, ACTION.LEFT, ACTION.LEFT,
      ACTION.HARD_DROP,
    ]);

    expect(planActions({ rotations: 0, x: 6 }, 4)).toEqual([
      ACTION.RIGHT, ACTION.RIGHT, ACTION.HARD_DROP,
    ]);
  });
});

describe('AI', () => {
  const estadoCon = (grid, shape, x) => ({
    board: grid,
    currentPiece: { type: 'I', shape, position: { x, y: 0 } },
    nextPiece: { type: 'O' },
  });

  test('entrega la jugada paso a paso y termina en hard drop', () => {
    const grid = emptyGrid();
    grid[19] = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const ai = new AI();
    const estado = estadoCon(grid, [[1, 1, 1, 1]], 3);

    const acciones = [];
    for (let i = 0; i < 10; i++) {
      const accion = ai.predictAction(estado);
      acciones.push(accion);
      if (accion === ACTION.HARD_DROP) break;
    }

    // Rotar a vertical y moverse de la columna 3 a la 0.
    expect(acciones).toEqual([
      ACTION.ROTATE, ACTION.LEFT, ACTION.LEFT, ACTION.LEFT, ACTION.HARD_DROP,
    ]);
  });

  test('planifica de nuevo tras completar la jugada anterior', () => {
    const ai = new AI();
    const estado = estadoCon(emptyGrid(), [[1, 1, 1, 1]], 3);

    let acciones = 0;
    while (ai.predictAction(estado) !== ACTION.HARD_DROP && acciones < 20) acciones++;
    expect(ai.plan).toHaveLength(0);

    // La siguiente llamada arranca una jugada nueva en lugar de devolver nada.
    expect(ai.predictAction(estado)).not.toBeNull();
  });

  test('reset descarta la jugada en curso', () => {
    const ai = new AI();
    const estado = estadoCon(emptyGrid(), [[1, 1, 1, 1]], 3);
    ai.predictAction(estado);
    expect(ai.plan.length).toBeGreaterThan(0);

    ai.reset();
    expect(ai.plan).toHaveLength(0);
  });

  test('devuelve null ante un estado inválido', () => {
    const ai = new AI();
    expect(ai.predictAction(null)).toBeNull();
    expect(ai.predictAction({})).toBeNull();
    expect(ai.predictAction({ board: emptyGrid() })).toBeNull();
    expect(ai.predictAction({ board: emptyGrid(), currentPiece: {} })).toBeNull();
  });

  test('devuelve null si no hay ninguna jugada posible', () => {
    const ai = new AI();
    const lleno = Array.from({ length: 20 }, () => new Array(10).fill(1));
    expect(ai.predictAction(estadoCon(lleno, [[1]], 3))).toBeNull();
  });
});
