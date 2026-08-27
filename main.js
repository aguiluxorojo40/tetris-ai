import Game from './modules/Game.js';
import AI from './modules/AI.js';
import GamepadController from './modules/Gamepad.js';
import { createPieceSequence, createPieceReader } from './modules/Utils.js';
import { CONFIG } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const startButton = document.getElementById(CONFIG.BUTTON_IDS.START_BUTTON);
  const difficultySelect = document.getElementById(CONFIG.BUTTON_IDS.DIFFICULTY_SELECT);
  const toggleAIButton = document.getElementById(CONFIG.BUTTON_IDS.TOGGLE_AI_BUTTON);
  const versusButton = document.getElementById(CONFIG.BUTTON_IDS.VERSUS_BUTTON);
  const aiLevelSelect = document.getElementById(CONFIG.BUTTON_IDS.AI_LEVEL);
  const optionsButton = document.getElementById(CONFIG.BUTTON_IDS.OPTIONS_BUTTON);
  const optionsMenu = document.querySelector(CONFIG.SELECTORS.OPTIONS_MENU);
  const bgImageInput = document.getElementById(CONFIG.BUTTON_IDS.BG_IMAGE_INPUT);
  const gamepadStatus = document.getElementById(CONFIG.BUTTON_IDS.GAMEPAD_STATUS);
  const resultBanner = document.getElementById(CONFIG.BUTTON_IDS.RESULT);
  const player1Name = document.getElementById('player1Name');
  const player2 = document.getElementById('player2');

  // Ids del tablero del rival en modo versus.
  const RIVAL_IDS = {
    board: 'board2',
    score: 'score2',
    level: 'level2',
    nextPiece: 'nextPiece2',
    garbage: 'garbage2',
    startButton: null,
  };

  let game = null;        // tablero principal (jugador humano, o la IA en solitario)
  let rivalGame = null;   // tablero de la IA en modo versus
  let aiActive = false;   // la IA juega el tablero principal
  let versus = false;
  let matchOver = false;

  let ai = new AI();       // cerebro del tablero principal
  let rivalAI = new AI();  // cerebro del rival

  function nivelActual() {
    return CONFIG.AI_LEVELS[aiLevelSelect.value] || CONFIG.AI_LEVELS.normal;
  }

  // Milisegundos entre acciones de la IA. Sin freno actuaría una vez por frame,
  // es decir 60 acciones por segundo: imposible de seguir con la vista.
  let aiDelay = nivelActual().delay;

  function aplicarNivel() {
    const nivel = nivelActual();
    aiDelay = nivel.delay;
    ai = new AI({ mistakeRate: nivel.mistakeRate });
    rivalAI = new AI({ mistakeRate: nivel.mistakeRate });
  }
  aplicarNivel();

  /**
   * Da un paso de IA sobre un tablero, respetando la cadencia elegida.
   */
  function stepAI(brain, target, timestamp) {
    if (!target || !target.isRunning) return;
    if (timestamp - (target.lastAIStep || 0) < aiDelay) return;
    target.lastAIStep = timestamp;

    const action = brain.predictAction(target.getGameState());
    if (action !== null && action !== undefined) target.executeAction(action);
  }

  /**
   * Bucle único para ambos tableros: no bloquea la interfaz.
   */
  function loop(timestamp) {
    if (aiActive && game) stepAI(ai, game, timestamp);
    if (versus && rivalGame) stepAI(rivalAI, rivalGame, timestamp);

    const sigue = (aiActive && game && game.isRunning) ||
                  (versus && rivalGame && rivalGame.isRunning);
    if (sigue) requestAnimationFrame(loop);
  }

  function runLoop() {
    requestAnimationFrame(loop);
  }

  function showResult(texto) {
    resultBanner.textContent = texto;
    resultBanner.hidden = false;
  }

  function hideResult() {
    resultBanner.hidden = true;
  }

  function stopGames() {
    if (game) game.stop();
    if (rivalGame) rivalGame.stop();
  }

  /**
   * Alterna la activación de la IA sobre el tablero principal.
   */
  function toggleAI() {
    if (versus) return; // en versus la IA siempre juega su propio tablero

    aiActive = !aiActive;
    toggleAIButton.textContent = aiActive ? 'Desactivar IA' : 'Activar IA';
    toggleAIButton.setAttribute('aria-pressed', aiActive);

    if (game) game.isAIPlaying = aiActive;
    if (aiActive) {
      ai.reset();
      runLoop();
    }
  }

  /**
   * Alterna el modo versus. No arranca la partida: sólo prepara la interfaz.
   */
  function toggleVersus() {
    versus = !versus;
    stopGames();
    hideResult();

    versusButton.setAttribute('aria-pressed', versus);
    versusButton.textContent = versus ? 'Salir de versus' : 'Versus';
    player2.hidden = !versus;
    document.body.classList.toggle('versus', versus);
    player1Name.textContent = versus ? 'Tú' : 'Jugador';

    // En versus la IA tiene su propio tablero: el interruptor no aplica.
    toggleAIButton.disabled = versus;
    if (versus && aiActive) {
      aiActive = false;
      toggleAIButton.textContent = 'Activar IA';
      toggleAIButton.setAttribute('aria-pressed', false);
    }

    startButton.disabled = false;
  }

  /**
   * Arranca una partida normal.
   */
  function startSingle() {
    if (game) game.stop();
    hideResult();

    const gravity = parseInt(difficultySelect.value, 10);
    aplicarNivel();
    game = new Game(gravity);
    game.isAIPlaying = aiActive;
    game.start();

    if (aiActive) runLoop();
  }

  /**
   * Arranca un duelo: dos tableros con la misma secuencia de piezas.
   */
  function startVersus() {
    stopGames();
    hideResult();
    matchOver = false;

    const gravity = parseInt(difficultySelect.value, 10);
    // Una única secuencia sembrada, compartida por ambos: mismas piezas, mismo
    // orden. Sin esto el duelo no sería comparable.
    const sequence = createPieceSequence(Date.now() >>> 0);

    const finish = quien => {
      if (matchOver) return;
      matchOver = true;
      stopGames();
      showResult(quien === 'humano'
        ? `Gana la IA — tú ${game.score} · IA ${rivalGame.score}`
        : `¡Ganas tú! — tú ${game.score} · IA ${rivalGame.score}`);
      startButton.disabled = false;
    };

    aplicarNivel(); // recoge el nivel elegido antes de empezar el duelo

    game = new Game(gravity, {
      pieceSource: createPieceReader(sequence),
      controls: true,
      onGameOver: () => finish('humano'),
      // Despejar líneas envía basura al rival (tabla de ataque estándar).
      onAttack: lineas => { if (rivalGame) rivalGame.receiveGarbage(lineas); },
    });

    rivalGame = new Game(gravity, {
      ids: RIVAL_IDS,
      pieceSource: createPieceReader(sequence),
      controls: false,   // el tablero de la IA no debe robar el teclado
      onGameOver: () => finish('ia'),
      onAttack: lineas => { if (game) game.receiveGarbage(lineas); },
    });
    rivalGame.isAIPlaying = true;

    game.start();
    rivalGame.start();
    runLoop();
  }

  function startGame() {
    if (versus) startVersus();
    else startSingle();
  }

  /**
   * Maneja la visualización del menú de opciones.
   */
  function toggleOptionsMenu() {
    const isShown = optionsMenu.classList.toggle('show');
    optionsButton.setAttribute('aria-expanded', isShown);
    optionsMenu.setAttribute('aria-hidden', !isShown);
  }

  /**
   * Cambia la imagen de fondo del tablero.
   */
  function changeBackground() {
    const file = bgImageInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      for (const id of ['board', 'board2']) {
        const tablero = document.getElementById(id);
        if (tablero) tablero.style.backgroundImage = `url('${e.target.result}')`;
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * El mando sólo controla la pieza si hay partida en curso y la IA no juega
   * ese tablero (mismo criterio que el control por teclado).
   */
  function isManualPlayEnabled() {
    return Boolean(game && game.isRunning && !game.isAIPlaying);
  }

  function updateGamepadStatus(connected) {
    if (!gamepadStatus) return;
    gamepadStatus.textContent = connected ? '🎮 Mando conectado' : '🎮 Sin mando';
    gamepadStatus.classList.toggle('connected', connected);
  }

  // Soporte de mando: se sondea a nivel de aplicación (no de partida) para que
  // el botón Start del mando pueda iniciar el juego.
  const gamepad = new GamepadController({
    onLeft: () => { if (isManualPlayEnabled()) game.movePiece(-1, 0); },
    onRight: () => { if (isManualPlayEnabled()) game.movePiece(1, 0); },
    onSoftDrop: () => { if (isManualPlayEnabled()) game.softDrop(); },
    onRotate: () => { if (isManualPlayEnabled()) game.rotatePiece(); },
    onHardDrop: () => { if (isManualPlayEnabled()) game.hardDrop(); },
    onStart: () => { if (!game || !game.isRunning) startGame(); },
    onConnectionChange: updateGamepadStatus,
  });

  // Event Listeners
  startButton.addEventListener('click', startGame);
  toggleAIButton.addEventListener('click', toggleAI);
  versusButton.addEventListener('click', toggleVersus);
  optionsButton.addEventListener('click', toggleOptionsMenu);
  bgImageInput.addEventListener('change', changeBackground);
  aiLevelSelect.addEventListener('change', aplicarNivel);

  updateGamepadStatus(false);
  gamepad.start();
});
