# Tetris AI 1.2

## Descripción
Este proyecto implementa una inteligencia artificial para el juego de Tetris. La IA está diseñada para maximizar la puntuación utilizando estrategias avanzadas.

## Características
- Implementación de algoritmos de IA para Tetris.
- Interfaz gráfica para visualizar el progreso del juego.
- Configuración ajustable para diferentes niveles de dificultad.

## Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/aguiluxorojo40/tetris-ai.git

## Controles

### Teclado
| Tecla | Acción |
|-------|--------|
| ← / → | Mover pieza |
| ↓ | Bajar (soft drop) |
| ↑ | Rotar |
| Espacio | Hard drop |

### Mando (cualquier gamepad)
El juego es compatible con cualquier mando que soporte la Gamepad API. En lugar
de depender de la etiqueta de cada botón (que varía entre fabricantes), las
acciones se enlazan a *regiones físicas* del mando, de modo que un controlador
desconocido sigue siendo jugable.

| Control | Acción |
|---------|--------|
| Cruceta / stick izquierdo | Mover y bajar |
| Cualquier botón frontal (A/B/X/Y) o arriba | Rotar |
| Cualquier gatillo o bumper (L1/R1/L2/R2) | Hard drop |
| Start / Select | Iniciar partida |

También se soporta el *hat switch* de los mandos genéricos y se admite el juego
con varios mandos conectados a la vez.

> Nota: por privacidad, los navegadores no exponen un mando hasta que se pulsa
> algún botón. Si el indicador muestra "Sin mando", pulsa cualquier botón.


## Cómo probarlo

### 1. Tests automáticos

```bash
npm install
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
