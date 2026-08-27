import Game from '../modules/Game.js';

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
    expect(game.board.grid[19][3]).toBe(1);
    expect(game.score).toBe(38);
  });

  test('checkLines elimina una línea completa y suma 10 puntos por línea', () => {
    jest.useFakeTimers();
    game.currentPiece = makePiece([[1]], 0, 0);
    game.board.grid[19] = new Array(10).fill(1); // fila completa
    game.checkLines();
    jest.advanceTimersByTime(600); // completa la animación de borrado
    expect(game.score).toBe(10);
    expect(game.board.grid[19].every(cell => cell === 0)).toBe(true);
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

  // Regresión: el borrado de líneas se anima durante 600 ms y, mientras tanto,
  // la grilla sigue conteniendo las líneas completas. Si la IA seguía jugando
  // durante ese intervalo, planificaba sobre un tablero desactualizado.
  test('la IA no juega mientras se animan las líneas borradas', () => {
    jest.useFakeTimers();
    game.currentPiece = makePiece([[1]], 4, 0);
    game.isAIPlaying = true;
    game.board.grid[19] = new Array(10).fill(1);

    game.checkLines();
    expect(game.isClearing).toBe(true);

    game.executeAction(2); // debe ignorarse
    expect(game.currentPiece.x).toBe(4);

    jest.advanceTimersByTime(600);
    expect(game.isClearing).toBe(false);

    game.executeAction(2); // ahora sí se aplica
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
    expect(game.isClearing).toBe(false);
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
