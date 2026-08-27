import { addControlListeners, removeControlListeners } from '../modules/Controls.js';

// jsdom no implementa PointerEvent; basta con un Event que se pueda cancelar.
const press = id => document.getElementById(id)
  .dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
const release = id => document.getElementById(id)
  .dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));

describe('Controls', () => {
  let mockGame;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="left"></button>
      <button id="right"></button>
      <button id="down"></button>
      <button id="hardDrop"></button>
      <button id="rotate"></button>
    `;
    mockGame = {
      movePiece: jest.fn(),
      softDrop: jest.fn(),
      hardDrop: jest.fn(),
      rotatePiece: jest.fn(),
    };
  });

  afterEach(() => {
    removeControlListeners();
    jest.useRealTimers();
  });

  test('cada botón dispara su acción al pulsarlo', () => {
    addControlListeners(mockGame);

    press('left');
    expect(mockGame.movePiece).toHaveBeenCalledWith(-1, 0);

    press('right');
    expect(mockGame.movePiece).toHaveBeenCalledWith(1, 0);

    press('down');
    expect(mockGame.softDrop).toHaveBeenCalled();

    press('hardDrop');
    expect(mockGame.hardDrop).toHaveBeenCalled();

    press('rotate');
    expect(mockGame.rotatePiece).toHaveBeenCalled();
  });

  test('la acción se dispara de inmediato, sin esperar al retardo', () => {
    jest.useFakeTimers();
    addControlListeners(mockGame);

    press('left');
    expect(mockGame.movePiece).toHaveBeenCalledTimes(1);
  });

  test('mantener pulsado repite el movimiento tras el retardo inicial', () => {
    jest.useFakeTimers();
    addControlListeners(mockGame);

    press('left');
    expect(mockGame.movePiece).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100); // aún dentro del retardo (170 ms)
    expect(mockGame.movePiece).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100); // superado el retardo: empieza a repetir
    expect(mockGame.movePiece).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(120); // dos intervalos más (60 ms cada uno)
    expect(mockGame.movePiece).toHaveBeenCalledTimes(4);
  });

  test('soltar el botón detiene la repetición', () => {
    jest.useFakeTimers();
    addControlListeners(mockGame);

    press('left');
    jest.advanceTimersByTime(300);
    const llamadas = mockGame.movePiece.mock.calls.length;

    release('left');
    jest.advanceTimersByTime(1000);
    expect(mockGame.movePiece).toHaveBeenCalledTimes(llamadas);
  });

  test('el hard drop nunca se repite al mantenerlo pulsado', () => {
    jest.useFakeTimers();
    addControlListeners(mockGame);

    press('hardDrop');
    jest.advanceTimersByTime(2000);
    expect(mockGame.hardDrop).toHaveBeenCalledTimes(1);
  });

  test('la rotación nunca se repite al mantenerla pulsada', () => {
    jest.useFakeTimers();
    addControlListeners(mockGame);

    press('rotate');
    jest.advanceTimersByTime(2000);
    expect(mockGame.rotatePiece).toHaveBeenCalledTimes(1);
  });

  test('removeControlListeners desconecta los botones', () => {
    addControlListeners(mockGame);
    removeControlListeners();

    press('left');
    press('right');
    press('down');
    press('hardDrop');
    press('rotate');

    expect(mockGame.movePiece).not.toHaveBeenCalled();
    expect(mockGame.softDrop).not.toHaveBeenCalled();
    expect(mockGame.hardDrop).not.toHaveBeenCalled();
    expect(mockGame.rotatePiece).not.toHaveBeenCalled();
  });

  test('removeControlListeners cancela una repetición en curso', () => {
    jest.useFakeTimers();
    addControlListeners(mockGame);

    press('left');
    jest.advanceTimersByTime(300);
    const llamadas = mockGame.movePiece.mock.calls.length;

    removeControlListeners();
    jest.advanceTimersByTime(1000);
    expect(mockGame.movePiece).toHaveBeenCalledTimes(llamadas);
  });
});
