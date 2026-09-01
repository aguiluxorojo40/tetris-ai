import { Piece } from '../modules/Piece.js';

describe('Piece Class', () => {
  test('should create a piece with given shape and color', () => {
    const shape = [[1, 0], [1, 1]];
    const piece = new Piece(shape, 'red');
    expect(piece.shape).toEqual(shape);
    expect(piece.color).toBe('red');
    expect(piece.x).toBe(0);
    expect(piece.y).toBe(0);
  });

  test('should store the piece type when provided', () => {
    const piece = new Piece([[1, 1]], 'cyan', 'I');
    expect(piece.type).toBe('I');
  });

  test('should move the piece to a new position', () => {
    const piece = new Piece([[1, 0], [1, 1]], 'red');
    piece.move(5, 10);
    expect(piece.x).toBe(5);
    expect(piece.y).toBe(10);
  });

  test('should rotate the piece', () => {
    const piece = new Piece([[1, 0], [1, 1]], 'red');
    piece.rotate();
    expect(piece.shape).toEqual([[1, 1], [1, 0]]); // Expectativa actualizada para rotación horaria
  });
});