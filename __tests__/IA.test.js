// __tests__/IA.test.js
// @tensorflow/tfjs se resuelve al stub determinista definido en
// test-utils/tfjs-stub.js vía moduleNameMapper (ver package.json).
import AI from '../modules/AI.js';

describe('AI', () => {
  let ai;

  beforeEach(async () => {
    ai = new AI('mock/model/path');
    await ai.loadModel();
  });

  test('loadModel carga un modelo con método predict', () => {
    expect(ai.model).not.toBeNull();
    expect(typeof ai.model.predict).toBe('function');
  });

  test('predictAction devuelve el índice de mayor probabilidad', async () => {
    // El stub tiene su máximo en el índice 2.
    const action = await ai.predictAction([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(action).toBe(2);
  });

  test('predictAction devuelve null si el modelo no está cargado', async () => {
    const sinModelo = new AI('otra/ruta');
    const action = await sinModelo.predictAction([0, 1, 2]);
    expect(action).toBeNull();
  });

  test('makeMove espera la predicción y la mapea a una acción coherente', async () => {
    // Acción 2 => "mover a la derecha" (mismo espacio que Game.executeAction).
    const move = await ai.makeMove([[0, 0], [1, 0]]);
    expect(move).toBe('move right');
  });
});
