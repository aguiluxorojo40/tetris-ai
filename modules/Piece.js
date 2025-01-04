export class Piece {
  constructor(shape, color) {
    this.shape = shape;
    this.color = color;
    this.x = 0;
    this.y = 0;
  }

  move(x, y) {
    this.x = x;
    this.y = y;
  }

  rotate() {
    this.shape = this.shape[0].map((_, colIndex) =>
      this.shape.map(row => row[colIndex]).reverse()
    );
  }
}
