# Tetris AI 1.2

## Descripción
Tetris jugable en el navegador, con una IA capaz de jugar sola. Sin dependencias
de runtime ni paso de compilación: son módulos ES nativos que se sirven tal cual.

## Características
- Tetris completo: rotación con wall kicks, pieza fantasma, hard drop y niveles.
- Control por teclado, botones en pantalla y **cualquier gamepad**.
- IA heurística que juega sola, sin dependencias externas.
- Configuración ajustable para diferentes niveles de dificultad.

## Modo versus

Dos tableros enfrentados: tú a la izquierda, la IA a la derecha. Ambos reciben
**exactamente la misma secuencia de piezas** (un generador sembrado y compartido,
no `Math.random`), de modo que el duelo es comparable.

### Basura

Sigue la tabla de ataque estándar del Tetris moderno:

| Despejas | Envías |
|---|---|
| Simple | — |
| Doble | 1 fila |
| Triple | 2 filas |
| Tetris | 4 filas |

La basura entrante queda **en cola** (contador ⬆) y sólo entra al tablero al
fijar una pieza *sin* despejar líneas. Eso da margen para contrarrestarla:
despejar líneas cancela primero la basura propia pendiente y sólo el sobrante
ataca al rival. Todas las filas de un mismo envío comparten la columna del
hueco ("basura limpia"), así que una I vertical las despeja de golpe. Pierde
quien desborde.

### Nivel de la IA

Regular sólo la velocidad no bastaba: la IA seguía siendo perfecta. Los niveles
la gradúan en dos ejes, cada cuánto actúa y con qué frecuencia elige adrede una
jugada mediocre (de la mitad peor de la lista, que es como falla un humano).

| Nivel | Cadencia | Fallos | Desbordes medidos |
|---|---|---|---|
| Principiante | 450 ms | 35 % | ~4 por cada 150 piezas |
| Normal | 250 ms | 15 % | ~3 por cada 150 piezas |
| Difícil | 120 ms | 5 % | ~1 por cada 150 piezas |
| Imposible | 40 ms | 0 % | 0 en 500 piezas |

## La IA

La IA es **heurística**, no un modelo entrenado. Evalúa todas las posiciones
finales posibles de la pieza actual (4 rotaciones × columnas disponibles),
simula cómo quedaría el tablero y elige la mejor según la **función de
evaluación de Pierre Dellacherie**, la referencia clásica del problema:

```
puntuación = -4·huecos - pozos acumulados - transiciones de fila
             - transiciones de columna - altura de caída + celdas erosionadas
```

| Rasgo | Qué mide |
|---|---|
| Huecos | celdas vacías tapadas por bloques |
| Pozos acumulados | suma de profundidades; un pozo de 3 pesa 1+2+3 |
| Transiciones de fila | alternancias lleno/vacío recorriendo cada fila |
| Transiciones de columna | ídem por columnas |
| Altura de caída | a qué altura queda la pieza |
| Celdas erosionadas | líneas despejadas × celdas propias en ellas |

El planificador **no guarda una lista de pasos**: en cada llamada deduce la
siguiente acción comparando la pieza actual con su destino. Es lo que la hace
robusta, porque entre dos acciones puede pasar cualquier cosa (la gravedad baja
o fija la pieza) que dejaría obsoleto un plan preestablecido.

Anteriormente esto era un modelo TensorFlow.js, que se retiró: eran más de un
megabyte de descarga para un Tetris de navegador, y el modelo nunca llegó a
existir (su ruta era un placeholder).

## Cómo probarlo

### 1. Tests automáticos

```bash
npm install   # sólo instala Jest y Babel: el juego no tiene dependencias
npm test
```

También se ejecutan solos en cada push y pull request mediante GitHub Actions.

### 2. Probar el juego en el navegador

El proyecto usa módulos ES nativos, así que **no funciona abriendo `index.html`
con doble clic** (el protocolo `file://` bloquea los módulos). Hay que servirlo
por HTTP:

```bash
npm run serve          # python3 -m http.server 8000
# o, si prefieres Node:
npm run serve:node
```

Y abrir <http://localhost:8000>. Pulsa **Iniciar Juego**.

El juego en sí no necesita Node ni instalar nada: basta con cualquier servidor
estático. En **Termux**, por ejemplo:

```bash
pkg install python
cd tetris-ai
python -m http.server 8000
```

y abrir <http://localhost:8000> en el navegador del móvil. Node sólo hace falta
para ejecutar los tests.

Controles de teclado: `←` `→` mover, `↓` bajar, `↑` rotar, `Espacio` hard drop.

### 3. Probar el mando

Conecta cualquier mando (USB o Bluetooth) y **pulsa cualquier botón**: por
privacidad, los navegadores no exponen el mando hasta la primera pulsación. El
indicador pasará a "🎮 Mando conectado".

Si no tienes un mando a mano, puedes simular uno desde la consola del navegador
(F12) sin tocar el código:

```js
// Simula un mando conectado
const pulsados = new Set();
navigator.getGamepads = () => [{
  id: 'Mando simulado', index: 0, mapping: 'standard', axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({
    pressed: pulsados.has(i), value: pulsados.has(i) ? 1 : 0
  }))
}];

// Pulsa un botón durante 120 ms
window.tap = i => { pulsados.add(i); setTimeout(() => pulsados.delete(i), 120); };

tap(15);  // derecha        tap(14);  // izquierda
tap(13);  // bajar          tap(0);   // rotar
tap(5);   // hard drop      tap(9);   // iniciar partida
```

Para mantener una dirección pulsada y ver la repetición automática (DAS):
`pulsados.add(14)` … `pulsados.delete(14)`.
