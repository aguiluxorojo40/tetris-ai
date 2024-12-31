import { addControlListeners, removeControlListeners } from './Controls';

describe('Controls Module', () => {
  let gameMock;

  beforeEach(() => {
    gameMock = {
      movePiece: jest.fn(),
      softDrop: jest.fn(),
      hardDrop: jest.fn(),
      rotatePiece: jest.fn()
    };

    document.body.innerHTML = `
      <button id="left"></button>
      <button id="right"></button>
      <button id="down"></button>
      <button id="hardDrop"></button>
      <button id="rotate"></button>
    `;
  });

  test('addControlListeners should add event listeners to buttons', () => {
    addControlListeners(gameMock);

    document.getElementById('left').click();
    expect(gameMock.movePiece).toHaveBeenCalledWith(-1, 0);

    document.getElementById('right').click();
    expect(gameMock.movePiece).toHaveBeenCalledWith(1, 0);

    document.getElementById('down').click();
    expect(gameMock.softDrop).toHaveBeenCalled();

    document.getElementById('hardDrop').click();
    expect(gameMock.hardDrop).toHaveBeenCalled();

    document.getElementById('rotate').click();
    expect(gameMock.rotatePiece).toHaveBeenCalled();
  });

  test('removeControlListeners should remove event listeners from buttons', () => {
    addControlListeners(gameMock);
    removeControlListeners();

    document.getElementById('left').click();
    expect(gameMock.movePiece).not.toHaveBeenCalled();

    document.getElementById('right').click();
    expect(gameMock.movePiece).not.toHaveBeenCalled();

    document.getElementById('down').click();
    expect(gameMock.softDrop).not.toHaveBeenCalled();

    document.getElementById('hardDrop').click();
    expect(gameMock.hardDrop).not.toHaveBeenCalled();

    document.getElementById('rotate').click();
    expect(gameMock.rotatePiece).not.toHaveBeenCalled();
  });
});
