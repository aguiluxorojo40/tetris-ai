#!/usr/bin/env python3
"""Saca la textura de color de un .glb de Meshy y la deja lista para el juego.

De un modelo de Meshy sólo se aprovecha el mapa de color base: la geometría del
bloque la construye modules/renderers/cuboChaflan.js con 108 triángulos, y los
mapas metálico, de normales y de emisión no se aprecian en un bloque de 25
píxeles.

    python3 tools/textura-desde-glb.py modelo.glb assets/queso.jpg

Opciones:
    --lado N     Tamaño de salida en píxeles (256 por defecto).
    --calidad N  Calidad JPEG (84 por defecto).
    --listar     No escribe nada: enumera lo que trae el archivo.

Necesita Pillow (pip install pillow). Vive fuera del árbol del juego, que sigue
sin dependencias.
"""

import argparse
import io
import json
import struct
import sys


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


def imagenes(gltf, binario):
    """Rinde (nombre, bytes) por cada imagen incrustada en el archivo."""
    for indice, imagen in enumerate(gltf.get('images', [])):
        if 'bufferView' not in imagen:
            continue  # imagen externa: Meshy no las usa
        vista = gltf['bufferViews'][imagen['bufferView']]
        ini = vista.get('byteOffset', 0)
        yield imagen.get('name', str(indice)), binario[ini:ini + vista['byteLength']]


def main():
    partes = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    partes.add_argument('glb')
    partes.add_argument('salida', nargs='?')
    partes.add_argument('--lado', type=int, default=256)
    partes.add_argument('--calidad', type=int, default=84)
    partes.add_argument('--listar', action='store_true')
    args = partes.parse_args()

    gltf, binario = leer_glb(args.glb)

    if args.listar:
        for malla in gltf.get('meshes', []):
            for prim in malla['primitives']:
                caras = gltf['accessors'][prim['indices']]['count'] // 3
                print(f'malla: {caras} triángulos, atributos {list(prim["attributes"])}')
        for nombre, crudo in imagenes(gltf, binario):
            print(f'imagen: {nombre} ({len(crudo)} bytes)')
        return

    if not args.salida:
        raise SystemExit('falta la ruta de salida (o usa --listar)')

    mapas = dict(imagenes(gltf, binario))
    if not mapas:
        raise SystemExit('el archivo no trae texturas: es una exportación sin texturizar')

    # Meshy nombra el mapa de color "base_color"; si cambiara, se coge el primero.
    nombre = next((n for n in mapas if 'base' in n.lower() or 'color' in n.lower()),
                  next(iter(mapas)))

    from PIL import Image
    imagen = Image.open(io.BytesIO(mapas[nombre])).convert('RGB')
    original = imagen.size
    imagen = imagen.resize((args.lado, args.lado), Image.LANCZOS)
    imagen.save(args.salida, quality=args.calidad, optimize=True)

    import os
    print(f'{nombre} {original[0]}x{original[1]} -> {args.salida} '
          f'{args.lado}x{args.lado}, {os.path.getsize(args.salida)} bytes')


if __name__ == '__main__':
    sys.exit(main())
