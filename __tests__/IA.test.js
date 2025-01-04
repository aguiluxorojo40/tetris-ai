// __tests__/IA.test.js

// Mock URL.createObjectURL before importing modules that use it
global.URL.createObjectURL = jest.fn(() => 'mockObjectURL');

// Mock the entire @tensorflow/tfjs module
jest.mock('@tensorflow/tfjs', () => {
  const originalModule = jest.requireActual('@tensorflow/tfjs');
  return {
    ...originalModule,
    loadGraphModel: jest.fn(async () => ({
      predict: jest.fn(async () => ({
        dataSync: () => [0.1, 0.3, 0.2, 0.25, 0.15], // Simulated probabilities for actions 0-4
      })),
    })),
  };
});

// Import modules after mocking
import IA from '../modules/AI.js';
import AI from '../modules/AI.js';

describe('IA', () => {
  test('should create IA instance', () => {
    const ia = new IA();
    expect(ia).toBeDefined();
  });
});

describe('AI', () => {
  let ai;

  beforeAll(async () => {
    ai = new AI('mock/model/path');
    await ai.loadModel();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('should load model successfully', () => {
    expect(ai.model).toBeDefined();
    expect(typeof ai.model.predict).toBe('function');
  });

  test('should predict action correctly', async () => {
    const gameState = [0, 1, 2, 3, 4, 5, 6, 7];
    const action = await ai.predictAction(gameState);
    expect(action).toBe(1);
  });

  test('AI should make a move', async () => {
    const board = [
      [0, 0],
      [1, 0],
    ];
    const move = ai.makeMove(board);
    expect(move).toBe('move right');
  });

  test('AI should load model with custom path', async () => {
    const aiInstance = new AI();
    await aiInstance.loadModel('mock/model/path');
    expect(aiInstance.model).not.toBeNull();
  });
});
