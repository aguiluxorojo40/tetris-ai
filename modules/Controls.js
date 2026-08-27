// modules/Controls.js
// Enlaza los botones táctiles/de pantalla con la instancia de juego.
//
// Se usan eventos de puntero (no click) por dos motivos: la respuesta es
// inmediata al tocar, y permite mantener pulsado para repetir el movimiento,
// que en un móvil es imprescindible: a toques sueltos, cruzar el tablero
// exige golpear la pantalla diez veces.

// Mismo esquema que el mando: retardo inicial y luego repetición rápida.
const REPEAT = {
  left: { delay: 170, interval: 60 },
  right: { delay: 170, interval: 60 },
  down: { delay: 60, interval: 50 },
};

const BUTTON_IDS = ['left', 'right', 'down', 'hardDrop', 'rotate'];

// Timers activos por botón, para poder cancelarlos al soltar.
const activeTimers = new Map();
// Listeners registrados, para poder retirarlos sin tocar el DOM.
const registered = [];

function stopRepeat(id) {
  const timer = activeTimers.get(id);
  if (timer) {
    clearTimeout(timer.timeout);
    clearInterval(timer.interval);
    activeTimers.delete(id);
  }
}

export function addControlListeners(game) {
  const acciones = {
    left: () => game.movePiece(-1, 0),
    right: () => game.movePiece(1, 0),
    down: () => game.softDrop(),
    hardDrop: () => game.hardDrop(),
    rotate: () => game.rotatePiece(),
  };

  for (const id of BUTTON_IDS) {
    const button = document.getElementById(id);
    if (!button) continue;

    const accion = acciones[id];
    const repeticion = REPEAT[id];

    const onPress = event => {
      // Evita que el navegador genere además un click sintético o haga scroll.
      if (event.cancelable) event.preventDefault();
      stopRepeat(id);
      accion();

      if (!repeticion) return;
      const timeout = setTimeout(() => {
        const interval = setInterval(accion, repeticion.interval);
        const actual = activeTimers.get(id);
        if (actual) actual.interval = interval;
      }, repeticion.delay);
      activeTimers.set(id, { timeout, interval: null });
    };

    const onRelease = () => stopRepeat(id);

    button.addEventListener('pointerdown', onPress);
    button.addEventListener('pointerup', onRelease);
    button.addEventListener('pointerleave', onRelease);
    button.addEventListener('pointercancel', onRelease);

    registered.push({ button, onPress, onRelease });
  }
}

export function removeControlListeners() {
  for (const { button, onPress, onRelease } of registered) {
    button.removeEventListener('pointerdown', onPress);
    button.removeEventListener('pointerup', onRelease);
    button.removeEventListener('pointerleave', onRelease);
    button.removeEventListener('pointercancel', onRelease);
  }
  registered.length = 0;

  for (const id of [...activeTimers.keys()]) stopRepeat(id);
}
