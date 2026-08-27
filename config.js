

// config.js
export const CONFIG = {

  BUTTON_IDS: {
    START_BUTTON: 'startButton',
    DIFFICULTY_SELECT: 'difficulty',
    TOGGLE_AI_BUTTON: 'toggleAIButton',
    OPTIONS_BUTTON: 'optionsButton',
    BG_IMAGE_INPUT: 'bgImageInput',
    BOARD: 'board',
    GAMEPAD_STATUS: 'gamepadStatus',
    VERSUS_BUTTON: 'versusButton',
    AI_LEVEL: 'aiLevel',
    RESULT: 'result'
  },

  // Niveles de la IA. Se gradúan en dos ejes: cada cuánto actúa y con qué
  // frecuencia elige adrede una jugada mediocre. Sólo con la velocidad la IA
  // seguía siendo perfecta, y una IA perfecta no hace divertido el versus.
  // Cifras medidas sobre 150 piezas con gravedad real.
  AI_LEVELS: {
    principiante: { delay: 450, mistakeRate: 0.35 }, // ~4 desbordes / 150 piezas
    normal:       { delay: 250, mistakeRate: 0.15 }, // ~3 desbordes / 150 piezas
    dificil:      { delay: 120, mistakeRate: 0.05 },
    imposible:    { delay: 40,  mistakeRate: 0 },    // 0 desbordes en 500 piezas
  },

  SELECTORS: {
    OPTIONS_MENU: '.options-menu'
  },

  GRAVITY_VALUES: {
    NORMAL: 500,
    HARD: 300,
    EASY: 700
  }
};
