# vendor

`three.module.min.js` es three.js r160, copiado tal cual desde el repositorio
oficial (https://github.com/mrdoob/three.js, licencia MIT).

Está aquí y no en un CDN porque el juego se sirve en local —también desde el
móvil, con Termux— y debe funcionar sin conexión.

Sólo se descarga al activar el modo 3D: `main.js` lo importa de forma dinámica,
de modo que una partida normal no carga ni un byte de esta carpeta.
