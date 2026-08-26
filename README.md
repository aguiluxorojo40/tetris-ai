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
