import Game, {
  ATTACK_TABLE,
  COMBO_TABLE,
  BACK_TO_BACK_BONUS,
  PERFECT_CLEAR_GARBAGE,
} from '../modules/Game.js';
import { GARBAGE_COLOR } from '../modules/Board.js';

// -----------------------------------------------------------------------------
// Utilidades de test
// -----------------------------------------------------------------------------

// Monta en el DOM todos los nodos que el constructor de Game necesita
// (tablero, marcadores y botones de control).
function setupDOM() {
  document.body.innerHTML = `
    <div id="board"></div>
    <span id="score"></span>
    <span id="level"></span>
    <div id="nextPiece"></div>
    <button id="startButton"></button>
    <button id="left"></button>
    <button id="right"></button>
    <button id="down"></button>
    <button id="hardDrop"></button>
    <button id="rotate"></button>
  `;
}

// Crea una pieza-mock determinista (evitamos la aleatoriedad de getRandomPiece).
function makePiece(shape, x, y, type = 'T') {
  return { shape, color: 'red', x, y, type };
}

// Grilla vacía de 20x10.
function emptyGrid() {
  return Array.from({ length: 20 }, () => new Array(10).fill(0));
}

describe('Game — inicialización', () => {
  let game;

  beforeEach(() => {
    setupDOM();
    game = new Game(1000);
  });

  afterEach(() => {
    game.stop();
  });

  test('inicializa con dimensiones y estado por defecto correctos', () => {
    expect(game.boardWidth).toBe(10);
    expect(game.boardHeight).toBe(20);
    expect(game.score).toBe(0);
    expect(game.level).toBe(1);
    expect(game.gravity).toBe(1000);
    expect(game.isAIPlaying).toBe(false);
    expect(game.isRunning).toBe(false);
    expect(game.currentPiece).toBeNull();
  });

  test('crea una grilla 20x10 y 200 celdas en el DOM', () => {
    expect(game.board.grid.length).toBe(20);
    expect(game.board.grid[0].length).toBe(10);
    expect(document.getElementById('board').children.length).toBe(200);
  });

  test('genera una pieza siguiente válida con tipo', () => {
    expect(game.nextPiece).toBeDefined();
    expect(typeof game.nextPiece.type).toBe('string');
    expect(Array.isArray(game.nextPiece.shape)).toBe(true);
  });
});

describe('Game — mecánica de movimiento', () => {
  let game;

  beforeEach(() => {
    setupDOM();
    game = new Game(1000);
    game.board.grid = emptyGrid();
  });

  afterEach(() => {
    game.stop();
  });

  test('canMove es true dentro de los límites y false al salirse por la derecha', () => {
    game.currentPiece = makePiece([[1, 1], [1, 1]], 0, 0, 'O');
    expect(game.canMove(0, 0, game.currentPiece.shape)).toBe(true);
    // Un cuadro 2x2 en x=8 no puede desplazarse otra columna a la derecha.
    game.currentPiece.x = 8;
    expect(game.canMove(1, 0, game.currentPiece.shape)).toBe(false);
  });

  test('canMove detecta colisión con bloques ya fijados', () => {
    game.currentPiece = makePiece([[1]], 3, 0);
    game.board.grid[1][3] = 1; // bloque justo debajo
    expect(game.canMove(0, 1, game.currentPiece.shape)).toBe(false);
  });

  test('movePiece desplaza horizontalmente sin bloquear', () => {
    game.currentPiece = makePiece([[1]], 4, 0);
    game.movePiece(1, 0);
    expect(game.currentPiece.x).toBe(5);
    game.movePiece(-1, 0);
    expect(game.currentPiece.x).toBe(4);
  });

  test('rotatePiece aplica una rotación horaria correcta', () => {
    game.currentPiece = makePiece([[0, 1, 0], [1, 1, 1]], 3, 0);
    game.rotatePiece();
    expect(game.currentPiece.shape).toEqual([[1, 0], [1, 1], [1, 0]]);
  });

  test('getGhostPosition proyecta la pieza hasta el fondo', () => {
    game.currentPiece = makePiece([[1]], 3, 0);
    expect(game.getGhostPosition()).toBe(19);
  });
});

describe('Game — bloqueo, hard drop y líneas', () => {
  let game;

  beforeEach(() => {
    setupDOM();
    game = new Game(1000);
    game.board.grid = emptyGrid();
  });

  afterEach(() => {
    game.stop();
    jest.useRealTimers();
  });

  test('hardDrop fija la pieza en el fondo y otorga puntos por celdas caídas', () => {
    game.currentPiece = makePiece([[1]], 3, 0);
    game.hardDrop();
    // Cae 19 filas => 19 * 2 = 38 puntos y celda fijada en la fila inferior.
    // La grilla guarda el color de la pieza, no un 1.
    expect(game.board.grid[19][3]).toBe('red');
    expect(game.score).toBe(38);
  });

  // Regresión: el borrado se difería 600 ms por la animación. Durante esa
  // ventana la grilla seguía conteniendo las líneas completas, la IA
  // planificaba sobre un tablero obsoleto y, peor aún, la gravedad seguía
  // fijando piezas sin control. Ahora es atómico y la animación, decorativa.
  test('checkLines borra la línea y puntúa de forma atómica', () => {
    jest.useFakeTimers();
    game.currentPiece = makePiece([[1]], 0, 0);
    game.board.grid[19] = new Array(10).fill(1); // fila completa

    const despejadas = game.checkLines();

    // Sin avanzar un solo milisegundo, el tablero ya está limpio.
    expect(despejadas).toBe(1);
    expect(game.score).toBe(10);
    expect(game.board.grid[19].every(cell => cell === 0)).toBe(true);
  });

  test('checkLines devuelve 0 si no hay líneas completas', () => {
    game.currentPiece = makePiece([[1]], 0, 0);
    expect(game.checkLines()).toBe(0);
  });
});

describe('Game — estado para la IA y fin de partida', () => {
  let game;

  beforeEach(() => {
    setupDOM();
    game = new Game(1000);
    game.board.grid = emptyGrid();
  });

  afterEach(() => {
    game.stop();
  });

  test('getGameState devuelve el tablero como matriz numérica y el tipo de pieza', () => {
    game.currentPiece = makePiece([[1, 1], [1, 1]], 4, 0, 'O');
    game.board.grid[19][0] = 1;
    const state = game.getGameState();

    expect(state.board.length).toBe(20);
    expect(state.board[0].length).toBe(10);
    expect(state.board[19][0]).toBe(1);
    expect(state.board[0][0]).toBe(0);
    expect(state.currentPiece.type).toBe('O');
    expect(typeof state.nextPiece.type).toBe('string');
  });

  test('gameOver detiene la partida y alerta cuando la pieza inicial no cabe', () => {
    window.alert = jest.fn();
    game.isAIPlaying = false;
    game.isRunning = true;
    // Tablero completamente lleno: la nueva pieza no podrá colocarse.
    game.board.grid = Array.from({ length: 20 }, () => new Array(10).fill(1));
    game.nextPiece = makePiece([[1, 1], [1, 1]], 0, 0, 'O');

    game.spawnPiece();

    expect(game.isRunning).toBe(false);
    expect(window.alert).toHaveBeenCalled();
  });
});

describe('Game — coordinación con la IA', () => {
  let game;

  beforeEach(() => {
    setupDOM();
    game = new Game(1000);
    game.board.grid = emptyGrid();
  });

  afterEach(() => {
    game.stop();
    jest.useRealTimers();
  });

  test('executeAction se ignora si la IA no está activa', () => {
    game.currentPiece = makePiece([[1]], 4, 0);
    game.isAIPlaying = false;
    game.executeAction(2); // derecha
    expect(game.currentPiece.x).toBe(4);
  });

  test('executeAction mueve la pieza con la IA activa', () => {
    game.currentPiece = makePiece([[1]], 4, 0);
    game.isAIPlaying = true;
    game.executeAction(2);
    expect(game.currentPiece.x).toBe(5);
  });

  test('resetGame limpia el tablero y la puntuación', () => {
    game.currentPiece = makePiece([[1]], 4, 0);
    game.nextPiece = makePiece([[1]], 4, 0);
    game.score = 500;
    game.board.grid[19][0] = 1;

    game.resetGame();

    expect(game.score).toBe(0);
    expect(game.level).toBe(1);
    expect(game.pendingGarbage).toBe(0);
    expect(game.board.grid[19][0]).toBe(0);
  });
});

describe('Game — dos partidas simultáneas (modo versus)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="board"></div><span id="score"></span><span id="level"></span>
      <div id="nextPiece"></div><button id="startButton"></button>
      <div id="board2"></div><span id="score2"></span><span id="level2"></span>
      <div id="nextPiece2"></div>
      <button id="left"></button><button id="right"></button><button id="down"></button>
      <button id="hardDrop"></button><button id="rotate"></button>
    `;
  });

  const RIVAL_IDS = {
    board: 'board2', score: 'score2', level: 'level2',
    nextPiece: 'nextPiece2', startButton: null,
  };

  test('cada partida usa sus propios elementos del DOM', () => {
    const uno = new Game(1000);
    const dos = new Game(1000, { ids: RIVAL_IDS, controls: false });

    expect(uno.boardElement.id).toBe('board');
    expect(dos.boardElement.id).toBe('board2');
    expect(dos.startButton).toBeNull();
    expect(uno.board).not.toBe(dos.board);

    uno.stop();
    dos.stop();
  });

  test('pieceSource permite compartir la secuencia de piezas', () => {
    const tipos = ['I', 'O', 'T', 'S'];
    let i = 0;
    const fuente = () => ({ type: tipos[i++ % 4], shape: [[1]], color: 'red', x: 0, y: 0 });

    const game = new Game(1000, { pieceSource: fuente, controls: false });
    expect(game.nextPiece.type).toBe('I');
    game.stop();
  });

  // Regresión: stop() retiraba los listeners globales sin comprobar si esta
  // partida los había registrado, así que al terminar la partida de la IA el
  // jugador humano se quedaba sin controles.
  test('detener la partida sin controles no desconecta a la otra', () => {
    const humano = new Game(1000);            // controls: true por defecto
    const rival = new Game(1000, { ids: RIVAL_IDS, controls: false });

    humano.currentPiece = makePiece([[1]], 4, 0);
    rival.stop();                             // no debe afectar al humano

    document.getElementById('right')
      .dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    expect(humano.currentPiece.x).toBe(5);

    humano.stop();
  });

  test('onGameOver sustituye al aviso por defecto', () => {
    window.alert = jest.fn();
    const alPerder = jest.fn();
    const game = new Game(1000, { controls: false, onGameOver: alPerder });

    game.board.grid = Array.from({ length: 20 }, () => new Array(10).fill(1));
    game.nextPiece = makePiece([[1, 1], [1, 1]], 0, 0, 'O');
    game.spawnPiece();

    expect(alPerder).toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    expect(game.isRunning).toBe(false);
  });
});

describe('Game — basura del modo versus', () => {
  let game;

  beforeEach(() => {
    setupDOM();
    game = new Game(1000, { controls: false });
    game.board.grid = emptyGrid();
    // Bloque suelto arriba: sin él, despejar la única fila con contenido
    // dejaría el tablero vacío y toda jugada cobraría perfect clear (+10),
    // falseando las cifras de ataque y cancelación que se miden aquí.
    game.board.grid[3][0] = 1;
  });

  afterEach(() => game.stop());

  test('la tabla de ataque es la estándar', () => {
    // simple 0, doble 1, triple 2, tetris 4
    expect(ATTACK_TABLE).toEqual([0, 0, 1, 2, 4]);
  });

  test.each([
    [1, 0, 'un simple'],
    [2, 1, 'un doble'],
    [3, 2, 'un triple'],
    [4, 4, 'un tetris'],
  ])('%s envía %i filas (%s)', (lineas, esperado) => {
    const enviado = jest.fn();
    game.onAttack = enviado;
    for (let i = 0; i < lineas; i++) game.board.grid[19 - i] = new Array(10).fill(1);

    game.checkLines();

    if (esperado === 0) expect(enviado).not.toHaveBeenCalled();
    else expect(enviado).toHaveBeenCalledWith(esperado);
  });

  test('receiveGarbage encola sin tocar el tablero', () => {
    game.receiveGarbage(3);
    expect(game.pendingGarbage).toBe(3);
    expect(game.board.grid[19].every(c => c === 0)).toBe(true);
  });

  // Defenderse tiene prioridad: lo que uno despeja cancela primero su propia
  // basura entrante y sólo el sobrante ataca al rival.
  test('despejar líneas cancela la basura entrante antes de atacar', () => {
    const enviado = jest.fn();
    game.onAttack = enviado;
    game.receiveGarbage(3);

    // Un tetris ataca con 4: cancela las 3 pendientes y envía 1.
    for (let i = 0; i < 4; i++) game.board.grid[19 - i] = new Array(10).fill(1);
    game.checkLines();

    expect(game.pendingGarbage).toBe(0);
    expect(enviado).toHaveBeenCalledWith(1);
  });

  test('si la cancelación absorbe todo el ataque, no se envía nada', () => {
    const enviado = jest.fn();
    game.onAttack = enviado;
    game.receiveGarbage(5);

    for (let i = 0; i < 3; i++) game.board.grid[19 - i] = new Array(10).fill(1); // triple: 2
    game.checkLines();

    expect(game.pendingGarbage).toBe(3);
    expect(enviado).not.toHaveBeenCalled();
  });

  test('la basura entra al fijar una pieza sin despejar líneas', () => {
    game.random = () => 0; // hueco siempre en la columna 0
    game.receiveGarbage(2);
    game.currentPiece = makePiece([[1]], 5, 0);
    game.isAIPlaying = true;

    game.executeAction(4); // hard drop, sin completar línea

    expect(game.pendingGarbage).toBe(0);
    expect(game.board.grid[19][0]).toBe(0);            // el hueco
    expect(game.board.grid[19][1]).toBe(GARBAGE_COLOR); // la basura va en gris
    expect(game.board.grid[18][0]).toBe(0);            // mismo hueco en ambas filas
  });

  test('la basura no entra si la jugada despeja líneas', () => {
    game.onAttack = () => {};
    game.receiveGarbage(2);
    game.board.grid[19] = new Array(10).fill(1);
    game.board.grid[19][5] = 0;
    game.currentPiece = makePiece([[1]], 5, 0);
    game.isAIPlaying = true;

    game.executeAction(4); // completa la línea

    expect(game.pendingGarbage).toBe(2); // sigue en cola
  });

  test('la basura que desborda el tablero termina la partida', () => {
    const perdida = jest.fn();
    game.onGameOver = perdida;
    game.board.grid[0][0] = 1;  // hay pila hasta arriba
    game.receiveGarbage(3);

    game.applyPendingGarbage();

    expect(perdida).toHaveBeenCalled();
  });
});

describe('Game — combos, back-to-back y perfect clear', () => {
  let game;
  let enviado;

  // Un bloque suelto arriba impide que las jugadas cuenten como perfect clear,
  // que si no se sumaría a todo y falsearía las cifras.
  beforeEach(() => {
    setupDOM();
    game = new Game(1000, { controls: false });
    game.board.grid = emptyGrid();
    game.board.grid[3][0] = 1;
    enviado = [];
    game.onAttack = n => enviado.push(n);
  });

  afterEach(() => game.stop());

  const completar = filas => {
    for (let i = 0; i < filas; i++) game.board.grid[19 - i] = new Array(10).fill(1);
    game.checkLines();
  };

  test('la tabla de combo es la del Guideline Standard', () => {
    expect(COMBO_TABLE).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5]);
  });

  // El contador arranca en -1: la primera pieza que despeja lo deja en 0, que
  // todavía no da bonus; el bonus empieza a partir del combo 2.
  test('el combo suma filas extra a partir del tercer despeje seguido', () => {
    completar(2); // combo 0 -> doble = 1
    completar(2); // combo 1 -> +0
    completar(2); // combo 2 -> +1
    completar(2); // combo 3 -> +1
    completar(2); // combo 4 -> +2

    expect(enviado).toEqual([1, 1, 2, 2, 3]);
  });

  test('fijar una pieza sin despejar rompe el combo', () => {
    completar(2);
    completar(2);
    expect(game.combo).toBe(1);

    game.currentPiece = makePiece([[1]], 0, 0);
    game.isAIPlaying = true;
    game.executeAction(4); // hard drop sin completar línea

    expect(game.combo).toBe(-1);
  });

  test('dos Tetris encadenados cobran el bonus back-to-back', () => {
    completar(4); // 4
    completar(4); // 4 + B2B, y el combo 1 no suma

    expect(enviado[0]).toBe(4);
    expect(enviado[1]).toBe(4 + BACK_TO_BACK_BONUS);
  });

  test('una jugada que no es Tetris rompe la cadena back-to-back', () => {
    completar(4);
    completar(2); // rompe la cadena
    expect(game.lastClearWasTetris).toBe(false);

    completar(4); // Tetris sin bonus: 4 + 1 del combo 3
    expect(enviado[2]).toBe(4 + 1);
  });

  test('vaciar el tablero cuenta como perfect clear', () => {
    game.board.grid = emptyGrid();          // sin el bloque marcador
    game.board.grid[19] = new Array(10).fill(1);

    game.checkLines();

    expect(game.board.isEmpty()).toBe(true);
    expect(enviado[0]).toBe(PERFECT_CLEAR_GARBAGE);
  });

  test('las filas de basura repiten hueco la mayoría de las veces', () => {
    let iguales = 0;
    for (let i = 0; i < 500; i++) {
      const huecos = game.buildGarbageHoles(2);
      if (huecos[0] === huecos[1]) iguales++;
    }
    // Alineación objetivo del 72%; se deja margen por ser aleatorio.
    expect(iguales / 500).toBeGreaterThan(0.6);
    expect(iguales / 500).toBeLessThan(0.85);
  });

  test('buildGarbageHoles devuelve una columna por fila, dentro del tablero', () => {
    const huecos = game.buildGarbageHoles(5);
    expect(huecos).toHaveLength(5);
    expect(huecos.every(c => c >= 0 && c < 10)).toBe(true);
  });
});

describe('Game — vista previa de la siguiente pieza', () => {
  beforeEach(setupDOM);

  // Regresión: drawNextPiece pintaba la vista previa de rojo fijo, el mismo
  // fallo que Board.draw tenía con las piezas ya fijadas.
  test('la vista previa usa el color de la pieza', () => {
    const game = new Game(1000, { controls: false });
    game.nextPiece = { shape: [[1, 1]], color: '#00e5e5', type: 'I', x: 0, y: 0 };

    game.drawNextPiece();

    const celdas = document.getElementById('nextPiece').children;
    expect(celdas.length).toBe(2);
    expect(celdas[0].style.backgroundColor).toBe('rgb(0, 229, 229)');
    game.stop();
  });
});
