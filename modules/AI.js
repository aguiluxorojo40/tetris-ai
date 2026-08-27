// TensorFlow se carga de forma perezosa (import dinámico) por dos motivos:
//  1. El juego debe poder ejecutarse sin la librería: es una dependencia muy
//     pesada que sólo hace falta si se activa la IA.
//  2. Con un import estático, un fallo al resolver el especificador rompería
//     todo el grafo de módulos y la página no arrancaría.
let tfPromise = null;

function loadTensorFlow() {
  if (!tfPromise) {
    tfPromise = import('@tensorflow/tfjs');
  }
  return tfPromise;
}

export default class AI {
  constructor(modelPath) {
    this.modelPath = modelPath;
    this.model = null;
    this.tf = null;
  }

  /**
   * Carga el modelo. Si TensorFlow o el modelo no están disponibles, se
   * registra el error y el juego sigue siendo jugable sin IA.
   */
  async loadModel() {
    try {
      this.tf = await loadTensorFlow();
      this.model = await this.tf.loadGraphModel(this.modelPath, { fromTFHub: false });
      console.log("Modelo de IA cargado con éxito.");
    } catch (error) {
      console.error("Error al cargar el modelo de IA:", error);
      this.model = null;
    }
  }

  /**
   * Recibe el estado del juego y devuelve la acción (0-4) con mayor probabilidad.
   * @param {Array} gameState - Representación del estado actual del juego.
   * @returns {number|null} - Acción recomendada o null en caso de error.
   */
  async predictAction(gameState) {
    if (!this.model || !this.tf) {
      console.error("Modelo no cargado. Asegúrate de llamar a loadModel primero.");
      return null;
    }

    try {
      // Normaliza el estado del juego según lo requiera tu modelo.
      // Por ejemplo, si el estado del juego está en el rango [0..7], lo normalizamos a [0..1].
      const normalizedState = gameState.map(cell => cell / 7);

      // Convierte el estado normalizado a un tensor de 2D (batch_size: 1)
      const inputTensor = this.tf.tensor2d([normalizedState], [1, normalizedState.length]);

      // Realiza la predicción utilizando el modelo.
      const prediction = await this.model.predict(inputTensor);

      // Procesa la salida del modelo para determinar la acción.
      const predictionData = prediction.dataSync();
      const action = predictionData.indexOf(Math.max(...predictionData));

      // Libera la memoria de los tensores.
      this.tf.dispose([inputTensor, prediction]);

      return action;
    } catch (error) {
      console.error("Error en predictAction:", error);
      return null;
    }
  }

  /**
   * Traduce la acción predicha a un movimiento del juego.
   * @param {Array} gameState - Representación del estado del juego.
   * @returns {Promise<string>} - Descripción de la acción realizada.
   */
  async makeMove(gameState) {
    // predictAction es asíncrona: hay que esperar el resultado antes de mapearlo.
    const action = await this.predictAction(gameState);

    // El mapeo usa el mismo espacio de acciones que Game.executeAction:
    // 0: Bajar (soft drop)
    // 1: Mover a la izquierda
    // 2: Mover a la derecha
    // 3: Rotar pieza
    // 4: Bajar rápidamente (hard drop)
    switch (action) {
      case 0:
        return 'move down';
      case 1:
        return 'move left';
      case 2:
        return 'move right';
      case 3:
        return 'rotate piece';
      case 4:
        return 'hard drop';
      default:
        return 'no action';
    }
  }
}
