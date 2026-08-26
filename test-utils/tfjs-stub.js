// Stub determinista de @tensorflow/tfjs para el entorno de test.
// Evita depender del comportamiento interno del modelo real y hace que las
// predicciones sean reproducibles.

// Probabilidades simuladas para las acciones 0..4. El máximo está en el
// índice 2, por lo que predictAction debe devolver 2 ("mover a la derecha").
const FAKE_PROBABILITIES = [0.1, 0.2, 0.4, 0.15, 0.15];

export async function loadGraphModel() {
  return {
    predict: () => ({
      dataSync: () => [...FAKE_PROBABILITIES],
    }),
  };
}

export function tensor2d(data, shape) {
  return { data, shape, dataSync: () => data };
}

export function dispose() {
  // No-op: en el stub no hay memoria de tensores que liberar.
}

export default { loadGraphModel, tensor2d, dispose };
