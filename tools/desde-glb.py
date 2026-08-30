#!/usr/bin/env python3
"""Saca de un .glb de Meshy lo poco que el juego aprovecha.

De un modelo de Meshy no se usa casi nada: el bloque lo construye
modules/renderers/cuboChaflan.js con 108 triángulos, y los mapas metálico, de
normales y de emisión no se aprecian en un bloque de 25 píxeles. Queda el mapa
de color base y, si el modelo trae algún adorno modelado —el rabillo del
tomate—, la parte de la malla que lo forma.

    python3 tools/desde-glb.py modelo.glb --listar
    python3 tools/desde-glb.py modelo.glb --textura assets/tomate.jpg
    python3 tools/desde-glb.py modelo.glb --malla assets/rabillo.json --sobre 0.78

Necesita Pillow para las texturas (pip install pillow). Vive fuera del árbol del
juego, que sigue sin dependencias.
"""

import argparse
import io
import json
import math
import os
import struct
import sys


# ---------------------------------------------------------------- lectura glb

FORMATOS = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
            5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
COMPONENTES = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def leer_glb(ruta):
    """Devuelve (json del glTF, bytes del buffer binario)."""
    datos = open(ruta, 'rb').read()
    magia, _, longitud = struct.unpack('<4sII', datos[:12])
    if magia != b'glTF':
        raise SystemExit(f'{ruta} no es un .glb')

    trozos, desplazamiento = {}, 12
    while desplazamiento < longitud:
        tam, tipo = struct.unpack('<I4s', datos[desplazamiento:desplazamiento + 8])
        trozos[tipo.rstrip(b'\x00')] = (desplazamiento + 8, tam)
        desplazamiento += 8 + tam

    ini, tam = trozos[b'JSON']
    gltf = json.loads(datos[ini:ini + tam].decode('utf8'))
    ini, tam = trozos.get(b'BIN', (0, 0))
    return gltf, datos[ini:ini + tam]


def accesor(gltf, binario, indice):
    """Lee un accessor entero como lista plana de números."""
    a = gltf['accessors'][indice]
    vista = gltf['bufferViews'][a['bufferView']]
    formato, tam = FORMATOS[a['componentType']]
    n = COMPONENTES[a['type']]
    paso = vista.get('byteStride') or tam * n
    base = vista.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [v for k in range(a['count'])
            for v in struct.unpack_from('<' + formato * n, binario, base + k * paso)]


def imagenes(gltf, binario):
    """Rinde (nombre, bytes) por cada imagen incrustada en el archivo."""
    for indice, imagen in enumerate(gltf.get('images', [])):
        if 'bufferView' not in imagen:
            continue  # imagen externa: Meshy no las usa
        vista = gltf['bufferViews'][imagen['bufferView']]
        ini = vista.get('byteOffset', 0)
        yield imagen.get('name', str(indice)), binario[ini:ini + vista['byteLength']]


def primitiva(gltf):
    """La única primitiva de la malla; Meshy no exporta más de una."""
    return gltf['meshes'][0]['primitives'][0]


# ----------------------------------------------------------------- reducción

def agrupar(posiciones, indices, rejilla):
    """Reduce la malla fundiendo en un punto los vértices de cada celda.

    El volumen se divide en una rejilla y los vértices que caen en la misma
    celda se sustituyen por su promedio. Es la forma más simple de bajar de
    dos millones de triángulos a unos cientos sin perder la silueta, que es lo
    único que se va a apreciar a este tamaño.
    """
    # Sólo cuentan los vértices que el recorte usa: la rejilla se tiende sobre
    # ellos y no sobre el modelo entero, o casi todas sus celdas saldrían
    # vacías y la reducción no ajustaría nada.
    usados = sorted(set(indices))
    ejes = [[posiciones[i * 3 + k] for i in usados] for k in range(3)]
    mn = [min(e) for e in ejes]
    mx = [max(e) for e in ejes]
    lado = [max(a - b, 1e-9) for a, b in zip(mx, mn)]

    celda_de = {}
    suma = {}
    for i in usados:
        p = posiciones[i * 3:i * 3 + 3]
        celda = tuple(min(rejilla - 1, int((p[k] - mn[k]) / lado[k] * rejilla))
                      for k in range(3))
        celda_de[i] = celda
        acumulado = suma.setdefault(celda, [0.0, 0.0, 0.0, 0])
        for k in range(3):
            acumulado[k] += p[k]
        acumulado[3] += 1

    orden = {celda: n for n, celda in enumerate(suma)}
    nuevas = []
    for celda in suma:
        acumulado = suma[celda]
        nuevas.extend(acumulado[k] / acumulado[3] for k in range(3))

    caras = []
    vistas = set()
    for t in range(0, len(indices), 3):
        tri = tuple(orden[celda_de[indices[t + k]]] for k in range(3))
        # Los triángulos que se colapsan sobre una o dos celdas desaparecen.
        if len(set(tri)) < 3:
            continue
        firma = tuple(sorted(tri))
        if firma in vistas:
            continue
        vistas.add(firma)
        caras.extend(tri)
    return nuevas, caras


def normales_suaves(posiciones, indices):
    """Normal por vértice, promediando las de las caras que lo tocan."""
    normales = [0.0] * len(posiciones)
    for t in range(0, len(indices), 3):
        a, b, c = (indices[t + k] for k in range(3))
        pa = posiciones[a * 3:a * 3 + 3]
        pb = posiciones[b * 3:b * 3 + 3]
        pc = posiciones[c * 3:c * 3 + 3]
        u = [pb[k] - pa[k] for k in range(3)]
        v = [pc[k] - pa[k] for k in range(3)]
        n = [u[1] * v[2] - u[2] * v[1],
             u[2] * v[0] - u[0] * v[2],
             u[0] * v[1] - u[1] * v[0]]
        for indice in (a, b, c):
            for k in range(3):
                normales[indice * 3 + k] += n[k]
    for i in range(0, len(normales), 3):
        largo = math.hypot(*normales[i:i + 3])
        if largo:
            for k in range(3):
                normales[i + k] /= largo
        else:
            normales[i + 1] = 1.0
    return normales


# -------------------------------------------------------------------- modos

def modo_listar(gltf, binario):
    for malla in gltf.get('meshes', []):
        for prim in malla['primitives']:
            caras = gltf['accessors'][prim['indices']]['count'] // 3
            pos = gltf['accessors'][prim['attributes']['POSITION']]
            print(f'malla: {caras} triángulos, atributos {list(prim["attributes"])}')
            print(f'  bbox min {[round(v, 4) for v in pos["min"]]}')
            print(f'  bbox max {[round(v, 4) for v in pos["max"]]}')
    for nombre, crudo in imagenes(gltf, binario):
        print(f'imagen: {nombre} ({len(crudo)} bytes)')


def modo_textura(gltf, binario, salida, lado, calidad):
    mapas = dict(imagenes(gltf, binario))
    if not mapas:
        raise SystemExit('el archivo no trae texturas: es una exportación sin texturizar')

    # Meshy nombra el mapa de color "base_color"; si cambiara, se coge el primero.
    nombre = next((n for n in mapas if 'base' in n.lower() or 'color' in n.lower()),
                  next(iter(mapas)))

    from PIL import Image
    imagen = Image.open(io.BytesIO(mapas[nombre])).convert('RGB')
    original = imagen.size
    imagen.resize((lado, lado), Image.LANCZOS).save(salida, quality=calidad, optimize=True)
    print(f'{nombre} {original[0]}x{original[1]} -> {salida} '
          f'{lado}x{lado}, {os.path.getsize(salida)} bytes')


def modo_malla(gltf, binario, salida, sobre, tope):
    prim = primitiva(gltf)
    posiciones = accesor(gltf, binario, prim['attributes']['POSITION'])
    indices = accesor(gltf, binario, prim['indices'])

    # Se queda con lo que está por encima del corte: en el tomate, el rabillo.
    recorte = [indices[t + k]
               for t in range(0, len(indices), 3)
               if all(posiciones[indices[t + j] * 3 + 1] > sobre for j in range(3))
               for k in range(3)]
    if not recorte:
        raise SystemExit(f'no hay ningún triángulo por encima de y={sobre}')
    print(f'{len(recorte) // 3} triángulos por encima de y={sobre}')

    # Busca la rejilla más fina que aún cabe en el tope de triángulos: cuanto
    # más fina, mejor se conserva la forma.
    mejor = None
    for rejilla in range(4, 40):
        nuevas, caras = agrupar(posiciones, recorte, rejilla)
        if len(caras) // 3 > tope:
            break
        mejor = (rejilla, nuevas, caras)
    if mejor is None:
        raise SystemExit(f'ni con la rejilla más basta se baja de {tope} triángulos')
    rejilla, posiciones, caras = mejor

    # Normaliza: centrado en X y Z, apoyado en y=0 y de una unidad de alto, para
    # que el tamaño y la posición los decida el registro de materiales.
    ejes = [posiciones[k::3] for k in range(3)]
    centro = [(min(ejes[k]) + max(ejes[k])) / 2 for k in range(3)]
    alto = max(ejes[1]) - min(ejes[1])
    for i in range(0, len(posiciones), 3):
        posiciones[i] = round((posiciones[i] - centro[0]) / alto, 6)
        posiciones[i + 1] = round((posiciones[i + 1] - min(ejes[1])) / alto, 6)
        posiciones[i + 2] = round((posiciones[i + 2] - centro[2]) / alto, 6)

    normales = [round(v, 6) for v in normales_suaves(posiciones, caras)]
    json.dump({'positions': posiciones, 'normals': normales, 'indices': caras},
              open(salida, 'w'))

    ancho = max(max(posiciones[0::3]) - min(posiciones[0::3]),
                max(posiciones[2::3]) - min(posiciones[2::3]))
    print(f'rejilla {rejilla} -> {len(caras) // 3} triángulos, '
          f'{len(posiciones) // 3} vértices, ancho {ancho:.3f} veces su alto')
    print(f'{salida}: {os.path.getsize(salida)} bytes')


def main():
    partes = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    partes.add_argument('glb')
    partes.add_argument('--listar', action='store_true')
    partes.add_argument('--textura', metavar='SALIDA.jpg')
    partes.add_argument('--lado', type=int, default=256)
    partes.add_argument('--calidad', type=int, default=84)
    partes.add_argument('--malla', metavar='SALIDA.json')
    partes.add_argument('--sobre', type=float,
                        help='altura por encima de la cual recortar la malla')
    partes.add_argument('--triangulos', type=int, default=300)
    args = partes.parse_args()

    gltf, binario = leer_glb(args.glb)

    if args.listar:
        modo_listar(gltf, binario)
    if args.textura:
        modo_textura(gltf, binario, args.textura, args.lado, args.calidad)
    if args.malla:
        if args.sobre is None:
            raise SystemExit('--malla necesita --sobre para saber dónde recortar')
        modo_malla(gltf, binario, args.malla, args.sobre, args.triangulos)
    if not (args.listar or args.textura or args.malla):
        raise SystemExit('elige un modo: --listar, --textura o --malla')


if __name__ == '__main__':
    sys.exit(main())
