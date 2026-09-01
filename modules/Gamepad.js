// modules/Gamepad.js
//
// Soporte de mando para el juego, pensado para funcionar con CUALQUIER gamepad.
//
// La Gamepad API no emite eventos por pulsación: hay que sondear el estado en
// cada frame. Este módulo se encarga de ese sondeo y traduce el estado bruto a
// acciones del juego, resolviendo tres problemas:
//
//   1. Mandos no estándar. En vez de depender de la etiqueta de cada botón
//      (que varía entre fabricantes), las acciones se enlazan a REGIONES
//      físicas: cualquier botón frontal rota, cualquier gatillo/bumper hace
//      hard drop. Así un mando desconocido sigue siendo jugable.
//   2. Direcciones. Se aceptan indistintamente la cruceta, el stick analógico
//      (con zona muerta) y el "hat switch" de los mandos genéricos.
//   3. Repetición de teclas. Sin control de repetición, mantener izquierda
//      movería la pieza 60 veces por segundo. Se aplica el esquema clásico
//      DAS/ARR (retardo inicial y luego repetición rápida).

// Índices de la asignación estándar del W3C. Se agrupan por región física
// para que un mando sin asignación estándar siga respondiendo de forma
// razonable.
export const DEFAULT_BINDINGS = {
  // Botones frontales (A/B/X/Y o sus equivalentes) + cruceta arriba.
  rotate: [0, 1, 2, 3, 12],
  // Bumpers y gatillos: acción destructiva, separada de los botones frontales.
  hardDrop: [4, 5, 6, 7],
  softDrop: [13],
  left: [14],
  right: [15],
  // Start / Select.
  start: [8, 9],
};

// Retardo inicial (delay) y cadencia de repetición (interval), en ms.
// Las acciones no listadas aquí sólo se disparan en el flanco de pulsación.
export const DEFAULT_REPEAT = {
  left: { delay: 170, interval: 50 },
  right: { delay: 170, interval: 50 },
  softDrop: { delay: 60, interval: 40 },
};

// Umbral a partir del cual se considera que un stick apunta a una dirección.
// Es más alto que una zona muerta normal porque convertimos un eje analógico
// en una señal de tipo cruceta.
const AXIS_THRESHOLD = 0.5;

// Un gatillo analógico puede no marcar `pressed` hasta el fondo del recorrido.
const BUTTON_VALUE_THRESHOLD = 0.5;

// Valores del "hat switch" (eje 9) en muchos mandos genéricos. En reposo el
// eje devuelve un valor fuera del rango [-1, 1].
const HAT_NEUTRAL_LIMIT = 1.1;
const HAT_TOLERANCE = 0.1;
const HAT_DIRECTIONS = [
  { value: -1.0, up: true },
  { value: -0.714, up: true, right: true },
  { value: -0.429, right: true },
  { value: -0.143, down: true, right: true },
  { value: 0.143, down: true },
  { value: 0.429, down: true, left: true },
  { value: 0.714, left: true },
  { value: 1.0, up: true, left: true },
];

const ACTIONS = ['left', 'right', 'softDrop', 'rotate', 'hardDrop', 'start'];

/**
 * Indica si un botón está pulsado, aceptando tanto el formato moderno
 * (objeto GamepadButton) como el antiguo (número).
 */
export function isButtonPressed(gamepad, index) {
  const button = gamepad.buttons && gamepad.buttons[index];
  if (button === undefined || button === null) return false;
  if (typeof button === 'number') return button > BUTTON_VALUE_THRESHOLD;
  return button.pressed === true || button.value > BUTTON_VALUE_THRESHOLD;
}

/**
 * Decodifica el "hat switch" de los mandos sin asignación estándar.
 * Devuelve null si el eje no parece un hat o está en reposo.
 */
export function readHatSwitch(gamepad) {
  const axes = gamepad.axes;
  if (!axes || axes.length < 10) return null;

  const value = axes[9];
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (Math.abs(value) > HAT_NEUTRAL_LIMIT) return null; // en reposo

  const match = HAT_DIRECTIONS.find(
    dir => Math.abs(dir.value - value) <= HAT_TOLERANCE
  );
  return match || null;
}

/**
 * Traduce el estado bruto de un mando a un conjunto de acciones activas.
 */
export function readGamepadActions(gamepad, bindings = DEFAULT_BINDINGS) {
  const active = {};
  for (const action of ACTIONS) active[action] = false;

  // 1. Botones, agrupados por región física.
  for (const action of ACTIONS) {
    const indices = bindings[action] || [];
    for (const index of indices) {
      if (isButtonPressed(gamepad, index)) {
        active[action] = true;
        break;
      }
    }
  }

  // 2. Stick analógico izquierdo (ejes 0 y 1), presente en casi cualquier mando.
  const axes = gamepad.axes || [];
  if (typeof axes[0] === 'number') {
    if (axes[0] < -AXIS_THRESHOLD) active.left = true;
    if (axes[0] > AXIS_THRESHOLD) active.right = true;
  }
  if (typeof axes[1] === 'number') {
    if (axes[1] > AXIS_THRESHOLD) active.softDrop = true;
    if (axes[1] < -AXIS_THRESHOLD) active.rotate = true; // arriba = rotar
  }

  // 3. Hat switch, sólo en mandos sin asignación estándar (los estándar ya
  //    exponen la cruceta como botones 12-15).
  if (gamepad.mapping !== 'standard') {
    const hat = readHatSwitch(gamepad);
    if (hat) {
      if (hat.left) active.left = true;
      if (hat.right) active.right = true;
      if (hat.down) active.softDrop = true;
      if (hat.up) active.rotate = true;
    }
  }

  return active;
}

/**
 * Combina el estado de varios mandos: cualquiera de ellos puede jugar.
 */
export function mergeActions(states) {
  const merged = {};
  for (const action of ACTIONS) {
    merged[action] = states.some(state => state[action]);
  }
  return merged;
}

export default class GamepadController {
  /**
   * @param {Object} handlers - Callbacks por acción (onLeft, onRight,
   *   onSoftDrop, onRotate, onHardDrop, onStart, onConnectionChange).
   * @param {Object} [options] - bindings, repeat, y `now` para tests.
   */
  constructor(handlers = {}, options = {}) {
    this.handlers = handlers;
    this.bindings = options.bindings || DEFAULT_BINDINGS;
    this.repeat = options.repeat || DEFAULT_REPEAT;
    this.now = options.now || (() => Date.now());

    this.running = false;
    this.connected = false;
    this._rafId = null;
    this._loop = this._loop.bind(this);

    // Estado de repetición por acción.
    this._state = {};
    for (const action of ACTIONS) {
      this._state[action] = { pressed: false, nextRepeat: 0 };
    }
  }

  /** ¿Soporta el navegador la Gamepad API? */
  static isSupported() {
    return typeof navigator !== 'undefined' &&
      typeof navigator.getGamepads === 'function';
  }

  /** Mandos actualmente conectados (la API devuelve huecos nulos). */
  getConnectedGamepads() {
    if (!GamepadController.isSupported()) return [];
    return Array.from(navigator.getGamepads() || []).filter(Boolean);
  }

  start() {
    if (this.running || !GamepadController.isSupported()) return false;
    this.running = true;
    if (typeof requestAnimationFrame === 'function') {
      this._rafId = requestAnimationFrame(this._loop);
    }
    return true;
  }

  stop() {
    this.running = false;
    if (this._rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
    // Se olvidan las pulsaciones para no arrastrar estado al reanudar.
    for (const action of ACTIONS) {
      this._state[action].pressed = false;
      this._state[action].nextRepeat = 0;
    }
  }

  _loop() {
    if (!this.running) return;
    this.poll();
    if (typeof requestAnimationFrame === 'function') {
      this._rafId = requestAnimationFrame(this._loop);
    }
  }

  /**
   * Lee los mandos y dispara las acciones. Es público para poder invocarlo
   * de forma determinista desde los tests.
   */
  poll() {
    const gamepads = this.getConnectedGamepads();

    // Notificar cambios de conexión (para el indicador de la interfaz).
    const isConnected = gamepads.length > 0;
    if (isConnected !== this.connected) {
      this.connected = isConnected;
      if (typeof this.handlers.onConnectionChange === 'function') {
        this.handlers.onConnectionChange(isConnected, gamepads);
      }
    }

    if (gamepads.length === 0) return;

    const actions = mergeActions(
      gamepads.map(gamepad => readGamepadActions(gamepad, this.bindings))
    );

    const timestamp = this.now();
    for (const action of ACTIONS) {
      this._processAction(action, actions[action], timestamp);
    }
  }

  _processAction(action, isActive, timestamp) {
    const state = this._state[action];

    if (!isActive) {
      state.pressed = false;
      return;
    }

    const repeat = this.repeat[action];

    if (!state.pressed) {
      // Flanco de pulsación: se dispara siempre.
      state.pressed = true;
      state.nextRepeat = repeat ? timestamp + repeat.delay : Infinity;
      this._fire(action);
      return;
    }

    // Mantenido: sólo repiten las acciones configuradas para ello.
    if (repeat && timestamp >= state.nextRepeat) {
      state.nextRepeat = timestamp + repeat.interval;
      this._fire(action);
    }
  }

  _fire(action) {
    const name = 'on' + action.charAt(0).toUpperCase() + action.slice(1);
    const handler = this.handlers[name];
    if (typeof handler === 'function') handler();
  }
}
