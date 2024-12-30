import Game from './modules/Game.js';
import AI from './modules/AI.js'; // Asegúrate de que el nombre del archivo es consistente
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

  let game = null;
  let ai = null;
  let aiActive = false;

  /**
   * Inicializa la IA cargando el modelo TFLite.
   */
  async function initAI() {
    toggleAIButton.disabled = true; // Deshabilita el botón mientras se carga la IA
    ai = new AI(CONFIG.MODEL_PATH); // Ruta centralizada al modelo .tflite
    await ai.loadModel(); 
    toggleAIButton.disabled = false; // Habilita el botón una vez cargada la IA
  }

  /**
   * Ciclo de la IA con requestAnimationFrame para no bloquear la interfaz.
   */
  async function runAI() {
    if (aiActive && game && game.isRunning) {
      const gameState = game.getGameState();
      const action = await ai.predictAction(gameState);
      if (action !== null) {
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

  // Event Listeners
  toggleAIButton.addEventListener('click', toggleAI);
  startButton.addEventListener('click', startGame);
  optionsButton.addEventListener('click', toggleOptionsMenu);
  bgImageInput.addEventListener('change', changeBackground);

  // Cargar la IA al inicio
  initAI();
});
