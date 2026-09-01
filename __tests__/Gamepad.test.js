import GamepadController, {
  isButtonPressed,
  readHatSwitch,
  readGamepadActions,
  mergeActions,
  DEFAULT_BINDINGS,
} from '../modules/Gamepad.js';

// -----------------------------------------------------------------------------
// Utilidades de test
// -----------------------------------------------------------------------------

// Construye un mando falso con la forma que expone la Gamepad API.
function makeGamepad({ buttons = [], axes = [0, 0], mapping = 'standard' } = {}) {
  return {
    id: 'Mando de prueba',
    index: 0,
    mapping,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      value: buttons.includes(i) ? 1 : 0,
      touched: buttons.includes(i),
    })),
  };
}

// Crea un controlador con tiempo inyectado para poder verificar la repetición.
function makeController(handlers = {}) {
  const clock = { time: 0 };
  const controller = new GamepadController(handlers, { now: () => clock.time });
  return { controller, clock };
}

function setConnectedGamepads(gamepads) {
  navigator.getGamepads = jest.fn(() => gamepads);
}

beforeEach(() => {
  setConnectedGamepads([]);
});

// -----------------------------------------------------------------------------

describe('isButtonPressed', () => {
  test('detecta un botón pulsado en formato objeto', () => {
    const gamepad = makeGamepad({ buttons: [0] });
    expect(isButtonPressed(gamepad, 0)).toBe(true);
    expect(isButtonPressed(gamepad, 1)).toBe(false);
  });

  test('detecta un gatillo analógico parcialmente accionado', () => {
    const gamepad = makeGamepad();
    gamepad.buttons[7] = { pressed: false, value: 0.8 };
    expect(isButtonPressed(gamepad, 7)).toBe(true);
  });

  test('ignora un gatillo apenas rozado', () => {
    const gamepad = makeGamepad();
    gamepad.buttons[7] = { pressed: false, value: 0.2 };
    expect(isButtonPressed(gamepad, 7)).toBe(false);
  });

  test('acepta el formato antiguo en el que los botones son números', () => {
    const gamepad = { buttons: [0, 1], axes: [], mapping: '' };
    expect(isButtonPressed(gamepad, 1)).toBe(true);
    expect(isButtonPressed(gamepad, 0)).toBe(false);
  });

  test('no falla si el botón no existe en ese mando', () => {
    const gamepad = { buttons: [], axes: [], mapping: '' };
    expect(isButtonPressed(gamepad, 15)).toBe(false);
  });
});

describe('readHatSwitch', () => {
  test('devuelve null si el mando no tiene hat switch', () => {
    expect(readHatSwitch(makeGamepad({ axes: [0, 0] }))).toBeNull();
  });

  test('devuelve null cuando el hat está en reposo', () => {
    const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.2857];
    expect(readHatSwitch(makeGamepad({ axes }))).toBeNull();
  });

  test('decodifica las direcciones cardinales', () => {
    const hatAt = value => readHatSwitch(
      makeGamepad({ axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, value] })
    );
    expect(hatAt(-1).up).toBe(true);
    expect(hatAt(-0.429).right).toBe(true);
    expect(hatAt(0.143).down).toBe(true);
    expect(hatAt(0.714).left).toBe(true);
  });

  test('decodifica una diagonal', () => {
    const hat = readHatSwitch(
      makeGamepad({ axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, -0.714] })
    );
    expect(hat.up).toBe(true);
    expect(hat.right).toBe(true);
  });
});

describe('readGamepadActions', () => {
  test('la cruceta mueve y baja', () => {
    expect(readGamepadActions(makeGamepad({ buttons: [14] })).left).toBe(true);
    expect(readGamepadActions(makeGamepad({ buttons: [15] })).right).toBe(true);
    expect(readGamepadActions(makeGamepad({ buttons: [13] })).softDrop).toBe(true);
  });

  test('cualquier botón frontal rota, sea cual sea su etiqueta', () => {
    for (const button of [0, 1, 2, 3]) {
      const actions = readGamepadActions(makeGamepad({ buttons: [button] }));
      expect(actions.rotate).toBe(true);
      expect(actions.hardDrop).toBe(false);
    }
  });

  test('cualquier gatillo o bumper hace hard drop', () => {
    for (const button of [4, 5, 6, 7]) {
      const actions = readGamepadActions(makeGamepad({ buttons: [button] }));
      expect(actions.hardDrop).toBe(true);
      expect(actions.rotate).toBe(false);
    }
  });

  test('Start y Select inician la partida', () => {
    expect(readGamepadActions(makeGamepad({ buttons: [8] })).start).toBe(true);
    expect(readGamepadActions(makeGamepad({ buttons: [9] })).start).toBe(true);
  });

  test('el stick analógico funciona como la cruceta', () => {
    expect(readGamepadActions(makeGamepad({ axes: [-0.9, 0] })).left).toBe(true);
    expect(readGamepadActions(makeGamepad({ axes: [0.9, 0] })).right).toBe(true);
    expect(readGamepadActions(makeGamepad({ axes: [0, 0.9] })).softDrop).toBe(true);
    expect(readGamepadActions(makeGamepad({ axes: [0, -0.9] })).rotate).toBe(true);
  });

  test('la zona muerta ignora la deriva del stick en reposo', () => {
    const actions = readGamepadActions(makeGamepad({ axes: [0.2, -0.3] }));
    expect(actions.left).toBe(false);
    expect(actions.right).toBe(false);
    expect(actions.softDrop).toBe(false);
    expect(actions.rotate).toBe(false);
  });

  test('un mando en reposo no activa ninguna acción', () => {
    const actions = readGamepadActions(makeGamepad());
    expect(Object.values(actions).every(value => value === false)).toBe(true);
  });

  test('el hat switch sólo se interpreta en mandos no estándar', () => {
    const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.714]; // izquierda

    const generico = makeGamepad({ axes, mapping: '' });
    expect(readGamepadActions(generico).left).toBe(true);

    // En un mando estándar el eje 9 no es un hat: no debe interpretarse.
    const estandar = makeGamepad({ axes, mapping: 'standard' });
    expect(readGamepadActions(estandar).left).toBe(false);
  });

  test('respeta unas asignaciones personalizadas', () => {
    const bindings = { ...DEFAULT_BINDINGS, rotate: [11] };
    const actions = readGamepadActions(makeGamepad({ buttons: [11] }), bindings);
    expect(actions.rotate).toBe(true);
  });
});

describe('mergeActions', () => {
  test('combina el estado de varios mandos', () => {
    const merged = mergeActions([
      { left: true, right: false, rotate: false },
      { left: false, right: true, rotate: false },
    ]);
    expect(merged.left).toBe(true);
    expect(merged.right).toBe(true);
    expect(merged.rotate).toBe(false);
  });
});

describe('GamepadController — disparo de acciones', () => {
  test('una pulsación mantenida de rotar sólo dispara una vez', () => {
    const onRotate = jest.fn();
    const { controller, clock } = makeController({ onRotate });
    setConnectedGamepads([makeGamepad({ buttons: [0] })]);

    controller.poll();
    clock.time = 500;
    controller.poll();
    clock.time = 1000;
    controller.poll();

    expect(onRotate).toHaveBeenCalledTimes(1);
  });

  test('soltar y volver a pulsar rotar dispara de nuevo', () => {
    const onRotate = jest.fn();
    const { controller } = makeController({ onRotate });

    setConnectedGamepads([makeGamepad({ buttons: [0] })]);
    controller.poll();
    setConnectedGamepads([makeGamepad()]); // soltar
    controller.poll();
    setConnectedGamepads([makeGamepad({ buttons: [0] })]);
    controller.poll();

    expect(onRotate).toHaveBeenCalledTimes(2);
  });

  test('el hard drop nunca se repite al mantenerlo pulsado', () => {
    const onHardDrop = jest.fn();
    const { controller, clock } = makeController({ onHardDrop });
    setConnectedGamepads([makeGamepad({ buttons: [5] })]);

    for (const time of [0, 200, 400, 600, 5000]) {
      clock.time = time;
      controller.poll();
    }

    expect(onHardDrop).toHaveBeenCalledTimes(1);
  });

  test('mover a la izquierda aplica el retardo inicial y luego repite (DAS/ARR)', () => {
    const onLeft = jest.fn();
    const { controller, clock } = makeController({ onLeft });
    setConnectedGamepads([makeGamepad({ buttons: [14] })]);

    clock.time = 0;
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(1); // disparo inmediato

    clock.time = 100; // aún dentro del retardo inicial (170 ms)
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(1);

    clock.time = 170; // fin del retardo: primera repetición
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(2);

    clock.time = 200; // dentro del intervalo de repetición (50 ms)
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(2);

    clock.time = 220; // siguiente repetición
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(3);
  });

  test('soltar la dirección reinicia el retardo inicial', () => {
    const onLeft = jest.fn();
    const { controller, clock } = makeController({ onLeft });

    setConnectedGamepads([makeGamepad({ buttons: [14] })]);
    clock.time = 0;
    controller.poll();

    setConnectedGamepads([makeGamepad()]); // soltar
    clock.time = 300;
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(1);

    setConnectedGamepads([makeGamepad({ buttons: [14] })]);
    clock.time = 310;
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(2); // inmediato, no repetición

    clock.time = 350; // no debe repetir todavía (retardo desde 310)
    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(2);
  });

  test('acepta la entrada de cualquiera de los mandos conectados', () => {
    const onRight = jest.fn();
    const { controller } = makeController({ onRight });
    setConnectedGamepads([
      makeGamepad(),                    // primer mando en reposo
      makeGamepad({ buttons: [15] }),   // segundo mando pulsando derecha
    ]);

    controller.poll();
    expect(onRight).toHaveBeenCalledTimes(1);
  });

  test('ignora los huecos nulos que devuelve la Gamepad API', () => {
    const onLeft = jest.fn();
    const { controller } = makeController({ onLeft });
    setConnectedGamepads([null, makeGamepad({ buttons: [14] }), null]);

    expect(() => controller.poll()).not.toThrow();
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  test('no dispara nada si no hay mandos conectados', () => {
    const onLeft = jest.fn();
    const { controller } = makeController({ onLeft });
    setConnectedGamepads([]);

    controller.poll();
    expect(onLeft).not.toHaveBeenCalled();
  });
});

describe('GamepadController — conexión y ciclo de vida', () => {
  test('notifica la conexión y la desconexión una sola vez por cambio', () => {
    const onConnectionChange = jest.fn();
    const { controller } = makeController({ onConnectionChange });

    setConnectedGamepads([makeGamepad()]);
    controller.poll();
    controller.poll(); // sigue conectado: no debe notificar de nuevo
    expect(onConnectionChange).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).toHaveBeenLastCalledWith(true, expect.any(Array));

    setConnectedGamepads([]);
    controller.poll();
    expect(onConnectionChange).toHaveBeenCalledTimes(2);
    expect(onConnectionChange).toHaveBeenLastCalledWith(false, expect.any(Array));
  });

  test('stop() olvida las pulsaciones en curso', () => {
    const onLeft = jest.fn();
    const { controller } = makeController({ onLeft });
    setConnectedGamepads([makeGamepad({ buttons: [14] })]);

    controller.poll();
    expect(onLeft).toHaveBeenCalledTimes(1);

    controller.stop();
    controller.poll(); // al reanudar, cuenta como pulsación nueva
    expect(onLeft).toHaveBeenCalledTimes(2);
  });

  test('isSupported detecta la ausencia de la Gamepad API', () => {
    const original = navigator.getGamepads;
    delete navigator.getGamepads;
    expect(GamepadController.isSupported()).toBe(false);

    const { controller } = makeController({});
    expect(controller.start()).toBe(false);
    expect(controller.getConnectedGamepads()).toEqual([]);
    expect(() => controller.poll()).not.toThrow();

    navigator.getGamepads = original;
  });
});
