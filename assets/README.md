# assets

Texturas de los bloques del modo 3D. Cada tetromino puede llevar la suya: la
textura es la identidad de la pieza, no una capa igual para todas. El reparto
está en `modules/renderers/materiales.js`.

| Archivo | Pieza | Origen |
|---|---|---|
| `queso.jpg` | O (el cuadrado) | Meshy AI, indicándole cubo biselado al 9% con textura de queso y aspecto low poly |

## Por qué la O

El queso es amarillo y la O es la pieza amarilla de la Guideline, así que el
material y el color de siempre coinciden en lugar de pelearse. Sobre una pieza
cian el mismo queso daría un verde sucio: o pierde el color de la pieza, o
pierde el aspecto de queso.

El color de la Guideline no desaparece al texturizar, se queda como tinte sobre
el material (el campo `tinte` del registro). Así una pieza se reconoce por dos
vías a la vez, que en versus es lo que permite leer el tablero del rival de un
vistazo.

## Qué se aprovecha de un modelo de Meshy

Sólo el mapa de color base, escalado a 256 px. Del cubo de queso, que venían
76 MB:

- La **geometría** (1.961.518 triángulos) se descarta: el bloque lo construye
  `modules/renderers/cuboChaflan.js` con 108 triángulos, y su bisel mide el
  mismo 9% que el del modelo.
- Los mapas **metálico, de normales y de emisión** se descartan: en un bloque
  de 25 píxeles no se aprecian y triplicarían la descarga.
- El mapa de **color base** pasa de 2048 a 256 px → 11 KB.

Para añadir una textura nueva:

```sh
python3 tools/textura-desde-glb.py modelo.glb assets/loquesea.jpg
```

y dar de alta la pieza en `modules/renderers/materiales.js`. Si un archivo no
carga, esa pieza se dibuja con su color plano de siempre y el juego sigue.
