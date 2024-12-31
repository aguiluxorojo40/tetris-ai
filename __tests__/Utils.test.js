import { getRandomPiece, animateLineClear } from './Utils.js';
import { Piece } from './Piece.js';

describe('Utils module', () => {
  test('getRandomPiece should return a Piece instance', () => {
    const piece = getRandomPiece();
    expect(piece).toBeInstanceOf(Piece);
  });

  test('animateLineClear should add and remove line-clear class', (done) => {
    document.body.innerHTML = '<div id="board"></div>';
    const boardElement = document.getElementById('board');
    for (let i = 0; i < 200; i++) {
      const cell = document.createElement('div');
      boardElement.appendChild(cell);
    }

    const lines = [0, 1];
    animateLineClear(boardElement, lines, () => {
      lines.forEach((lineIndex) => {
        for (let x = 0; x < 10; x++) {
          const idx = lineIndex * 10 + x;
          expect(boardElement.children[idx].classList.contains('line-clear')).toBe(false);
        }
      });
      done();
    });

    lines.forEach((lineIndex) => {
      for (let x = 0; x < 10; x++) {
        const idx = lineIndex * 10 + x;
        expect(boardElement.children[idx].classList.contains('line-clear')).toBe(true);
      }
    });
  });
});
