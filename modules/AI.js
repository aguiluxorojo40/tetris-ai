import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-tflite';

export default class AI {
  constructor(modelPath) {
    this.modelPath = modelPath;
    this.model = null;
  }

  /**
   * Carga el modelo TFLite utilizando tfjs-tflite.
   */
  async loadModel() {
    try {
      this.model = await tf.loadGraphModel(this.modelPath, { fromTFHub: false });
      console.log("Modelo de IA cargado con éxito.");
    } catch (error) {
      console.error("Error al cargar el modelo de IA:", error);
    }
  }

  /**
   * Recibe el estado del juego y devuelve la acción (0-4) con mayor probabilidad.
   * @param {Array} gameState - Representación del estado actual del juego.
   * @returns {number|null} - Acción recomendada o null en caso de error.
   */
  async predictAction(gameState) {
    if (!this.model) {
      console.error("Modelo no cargado. Asegúrate de llamar a loadModel primero.");
      return null;
    }

    try {
      // Normaliza el estado del juego según lo requiera tu modelo.
      // Por ejemplo, si el estado del juego está en el rango [0..7], lo normalizamos a [0..1].
      const normalizedState = gameState.map(cell => cell / 7);

      // Convierte el estado normalizado a un tensor de 2D (batch_size: 1)
      const inputTensor = tf.tensor2d([normalizedState], [1, normalizedState.length]);

      // Realiza la predicción utilizando el modelo.
      const prediction = await this.model.predict(inputTensor);

      // Procesa la salida del modelo para determinar la acción.
      // Esto dependerá de cómo esté estructurada la salida de tu modelo.
      // Por ejemplo, si la salida es un vector de probabilidades para cada acción:
      const predictionData = prediction.dataSync();
      const action = predictionData.indexOf(Math.max(...predictionData));

      // Libera la memoria de los tensores.
      tf.dispose([inputTensor, prediction]);

      return action;
    } catch (error) {
      console.error("Error en predictAction:", error);
      return null;
    }
  }

  /**
   * Simula una acción de IA basada en el movimiento predicho.
   * @param {Array} board - Representación del tablero del juego.
   * @returns {string} - Descripción de la acción realizada.
   */
  makeMove(board) {
    // Aquí deberías transformar la acción numérica en un movimiento real en el juego.
    // Por ejemplo:
    const action = this.predictAction(board);
    // Mapear el número a una acción específica.
    // 0: Mover a la izquierda
    // 1: Mover a la derecha
    // 2: Bajar suavemente
    // 3: Bajar rápidamente (hard drop)
    // 4: Rotar pieza

    switch (action) {
      case 0:
        // Logic to move left
        return 'move left';
      case 1:
        // Logic to move right
        return 'move right';
      case 2:
        // Logic for soft drop
        return 'soft drop';
      case 3:
        // Logic for hard drop
        return 'hard drop';
      case 4:
        // Logic to rotate piece
        return 'rotate piece';
      default:
        return 'no action';
    }
  }
}
