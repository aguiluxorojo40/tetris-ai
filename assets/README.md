# assets

`cubo.json` es el cubo generado con Meshy AI, reducido para poder usarse en el
juego. El original venía con 1.938.500 triángulos, sin normales ni UVs (es la
fase de *preview* de Meshy, anterior al texturizado).

Se le aplicó una reducción por agrupamiento espacial —el volumen se divide en
una rejilla y los vértices de cada celda se funden en su promedio— hasta 3.531
triángulos, se normalizó a un cubo unidad centrado en el origen y se le
calcularon normales suaves.

El formato es un JSON plano con `positions`, `normals` e `indices`, que se
carga directamente en una `BufferGeometry`. Se eligió así para no tener que
incluir el GLTFLoader de three.js, que va aparte de la librería principal.
Cuando haya una exportación de Meshy con texturas, habrá que traerlo.
