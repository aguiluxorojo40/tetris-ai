import Game from './modules/Game.js';
import AI from './modules/AI.js'; // Asegúrate de que el nombre del archivo es consistente
import GamepadController from './modules/Gamepad.js';
import { CONFIG } from './config.js'; // Archivo de configuración (ver abajo)

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const startButton = document.getElementById(CONFIG.BUTTON_IDS.START_BUTTON);
  const difficultySelect = document.getElementById(CONFIG.BUTTON_IDS.DIFFICULTY_SELECT);
  const toggleAIButton = document.getElementById(CONFIG.BUTTON_IDS.TOGGLE_AI_BUTTON);
  const optionsButton = document.getElementById(CONFIG.BUTTON_IDS.OPTIONS_BUTTON);
  const optionsMenu = document.querySelector(CONFIG.SELECTORS.OPTIONS_MENU);
  const bgImageInput = document.getElementById(CONFIG.BUTTON_IDS.BG_IMAGE_INPUT);
  const tetrisBoard = document.getElementById(CONFIG.BUTTON_IDS.BOARD);
  const gamepadStatus = document.getElementById(CONFIG.BUTTON_IDS.GAMEPAD_STATUS);

  let game = null;
  let ai = null;
  let aiActive = false;

  /**
   * Inicializa la IA. Es heurística y no carga ningún modelo, así que está
   * lista de inmediato.
   */
  function initAI() {
    ai = new AI();
  }

  /**
   * Ciclo de la IA con requestAnimationFrame para no bloquear la interfaz.
   */
  function runAI() {
    if (aiActive && game && game.isRunning) {
      const gameState = game.getGameState();
      const action = ai.predictAction(gameState);
      if (action !== null && action !== undefined) {
        game.executeAction(action);
      }
      requestAnimationFrame(runAI);
    }
  }

  /**
   * Alterna la activación de la IA.
   */
  function toggleAI() {
    aiActive = !aiActive;
    toggleAIButton.textContent = aiActive ? "Desactivar IA" : "Activar IA";
    toggleAIButton.setAttribute('aria-pressed', aiActive);

    if (aiActive && ai && game && game.isRunning) {
      game.isAIPlaying = true;
      runAI();
    } else if (game) {
      game.isAIPlaying = false;
    }
  }

  /**
   * Inicia el juego con la dificultad seleccionada.
   */
  function startGame() {
    if (game) game.stop();

    const gravity = parseInt(difficultySelect.value, 10);
    if (ai) ai.reset(); // descarta cualquier jugada planificada de la partida anterior
    game = new Game(gravity);
    game.start();

    // Si la IA está activa al iniciar, comienza el ciclo de IA
    if (aiActive && ai) {
      game.isAIPlaying = true;
      runAI();
    }
  }

  /**
   * Maneja la visualización del menú de opciones.
   */
  function toggleOptionsMenu() {
    const isShown = optionsMenu.classList.toggle('show');
    optionsButton.setAttribute('aria-expanded', isShown);
    optionsMenu.setAttribute('aria-hidden', !isShown);

    // Para evitar que la IA siga actuando mientras mostramos el menú
    if (isShown) {
      aiActive = false;
      if (game) game.isAIPlaying = false;
      toggleAIButton.textContent = "Activar IA";
      toggleAIButton.setAttribute('aria-pressed', false);
    }
  }

  /**
   * Cambia la imagen de fondo del tablero.
   */
  function changeBackground() {
    const file = bgImageInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageURL = e.target.result;
        tetrisBoard.style.backgroundImage = `url('${imageURL}')`;
        tetrisBoard.style.backgroundSize = 'cover';
        tetrisBoard.style.backgroundPosition = 'center';
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * El mando sólo controla la pieza si hay partida en curso y la IA no juega
   * (mismo criterio que el control por teclado).
   */
  function isManualPlayEnabled() {
    return Boolean(game && game.isRunning && !game.isAIPlaying);
  }

  /**
   * Muestra si hay algún mando conectado.
   */
  function updateGamepadStatus(connected) {
    if (!gamepadStatus) return;
    gamepadStatus.textContent = connected
      ? '🎮 Mando conectado'
      : '🎮 Sin mando';
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
  toggleAIButton.addEventListener('click', toggleAI);
  startButton.addEventListener('click', startGame);
  optionsButton.addEventListener('click', toggleOptionsMenu);
  bgImageInput.addEventListener('change', changeBackground);

  // Cargar la IA al inicio
  initAI();

  // Arrancar el sondeo del mando (si el navegador lo soporta).
  updateGamepadStatus(false);
  gamepad.start();
});
