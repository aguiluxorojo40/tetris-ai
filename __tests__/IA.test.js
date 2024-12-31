import AI from './IA';

describe('AI', () => {
  let ai;

  beforeAll(async () => {
    ai = new AI('path/to/model.tflite');
    await ai.loadModel();
  });

  test('should load model successfully', async () => {
    expect(ai.model).not.toBeNull();
  });

  test('should predict action correctly', async () => {
    const gameState = {
      board: Array(20).fill(Array(10).fill(0)),
      currentPiece: { type: 1, rotation: 0, position: { x: 5, y: 0 } },
      nextPiece: { type: 2 }
    };

    const action = await ai.predictAction(gameState);
    expect(action).toBeGreaterThanOrEqual(0);
    expect(action).toBeLessThanOrEqual(4);
  });
});
