# assets

Texturas y adornos de los bloques del modo 3D. Cada tetromino puede llevar los
suyos: la textura es la identidad de la pieza, no una capa igual para todas. El
reparto está en `modules/renderers/materiales.js`.

| Archivo | Pieza | Origen |
|---|---|---|
| `queso.jpg` | O (el cuadrado) | Meshy AI: cubo biselado al 9% con textura de queso, low poly |
| `tomate.jpg` | Z (la roja) | Meshy AI: el mismo encargo con textura de tomate |
| `rabillo.json` | Z | El rabillo de ese mismo modelo de tomate, recortado y reducido |

## Por qué esas piezas

El queso es amarillo y la O es la pieza amarilla de la Guideline; el tomate es
rojo y la Z es la roja. Material y color coinciden en lugar de pelearse: sobre
una pieza cian, el queso daría un verde sucio.

El color de la Guideline no desaparece al texturizar, se queda como tinte sobre
el material (el campo `tinte` del registro). Así una pieza se reconoce por dos
vías a la vez, que en versus es lo que permite leer el tablero del rival de un
vistazo.

## El rabillo

Es lo único que se aprovecha de la geometría de Meshy, porque no hay forma de
sacarlo de una textura. Del modelo de tomate se recortó lo que quedaba por
encima de `y = 0.78`, donde la sección se estrecha de 1,55 a 0,12, y esos
32.324 triángulos se redujeron a 287.

Lo luce **un bloque por cada grupo de tomates pegados entre sí**, el más alto, y
sólo si tiene la casilla de arriba libre. Un tetromino son cuatro casillas y
cuatro rabillos serían un despropósito; además así el adorno asoma siempre a un
hueco y nunca se mete dentro del bloque de encima.

Es decoración y nada más: no lo ve la colisión, ni el fijado de piezas, ni el
despeje de líneas, ni la evaluación de la IA. Las piezas lo atraviesan porque
para el juego, sencillamente, no está.

## Qué se aprovecha de un modelo de Meshy

Sólo el mapa de color base, escalado a 256 px, y algún adorno suelto. Del cubo
de tomate, que venían 76 MB:

- La **geometría del cubo** (1.982.668 triángulos) se descarta: el bloque lo
  construye `modules/renderers/cuboChaflan.js` con 108 triángulos, y su bisel
  mide el mismo 9% que el del modelo.
- Los mapas **metálico, de normales y de emisión** se descartan: en un bloque
  de 25 píxeles no se aprecian y triplicarían la descarga.
- El mapa de **color base** pasa de 2048 a 256 px → 9 KB.

Para añadir una textura nueva:

```sh
python3 tools/desde-glb.py modelo.glb --listar
python3 tools/desde-glb.py modelo.glb --textura assets/loquesea.jpg
python3 tools/desde-glb.py modelo.glb --malla assets/adorno.json --sobre 0.78
```

y dar de alta la pieza en `modules/renderers/materiales.js`. Si un archivo no
carga, esa pieza se dibuja con su color plano de siempre y el juego sigue.
