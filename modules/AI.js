

import * as tf from '@tensorflow/tfjs';
import * as tflite from '@tensorflow/tfjs-tflite';

export default class AI {
  constructor(modelPath) {
    this.modelPath = modelPath;
    this.model = null;
  }

  async loadModel() {
    try {
      this.model = await tflite.loadTFLiteModel(this.modelPath);
      console.log("Modelo de IA cargado con éxito.");
    } catch (error) {
      console.error("Error al cargar el modelo de IA:", error);
    }
  }

  /**
   * Recibe el estado del juego y devuelve la acción (0-4) con mayor probabilidad.
   */
  async predictAction(gameState) {
    if (!this.model) {
      console.error("Modelo no cargado. Asegúrate de llamar a loadModel primero.");
      return null;
    }

    try {
      // Normaliza el tablero [0..7] -> [0..1]
      const boardFlat = gameState.board.flat().map(cell => cell / 7);

      // Información de la pieza actual
      const currentPieceInfo = [
        gameState.currentPiece.type / 7,
        gameState.currentPiece.rotation / 3,
        gameState.currentPiece.position.x / 10,
        gameState.currentPiece.position.y / 20
      ];

      // Información de la siguiente pieza
      const nextPieceInfo = [ gameState.nextPiece.type / 7 ];

      // Combina todo en un solo vector
      const inputArray = boardFlat.concat(currentPieceInfo, nextPieceInfo);

      // Ajusta la forma según tu modelo. En este caso, [1, inputLength].
      const inputTensor = tf.tensor(inputArray, [1, inputArray.length]);
      const prediction = this.model.predict(inputTensor);

      // Devuelve la acción con mayor probabilidad
      const action = prediction.argMax(-1).dataSync()[0];
      return action;
    } catch (error) {
      console.error("Error durante la predicción:", error);
      return null;
    }
  }
}
