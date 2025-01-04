import { addControlListeners, removeControlListeners } from '../modules/Controls.js';

describe('Controls module', () => {
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
  });

  test('addControlListeners should add event listeners', () => {
    addControlListeners(mockGame);

    document.getElementById('left').click();
    expect(mockGame.movePiece).toHaveBeenCalledWith(-1, 0);

    document.getElementById('right').click();
    expect(mockGame.movePiece).toHaveBeenCalledWith(1, 0);

    document.getElementById('down').click();
    expect(mockGame.softDrop).toHaveBeenCalled();

    document.getElementById('hardDrop').click();
    expect(mockGame.hardDrop).toHaveBeenCalled();

    document.getElementById('rotate').click();
    expect(mockGame.rotatePiece).toHaveBeenCalled();
  });

  test('removeControlListeners should remove event listeners from buttons', () => {
    addControlListeners(mockGame);
    removeControlListeners();

    document.getElementById('left').click();
    expect(mockGame.movePiece).not.toHaveBeenCalled();

    document.getElementById('right').click();
    expect(mockGame.movePiece).not.toHaveBeenCalled();

    document.getElementById('down').click();
    expect(mockGame.softDrop).not.toHaveBeenCalled();

    document.getElementById('hardDrop').click();
    expect(mockGame.hardDrop).not.toHaveBeenCalled();

    document.getElementById('rotate').click();
    expect(mockGame.rotatePiece).not.toHaveBeenCalled();
  });
});
