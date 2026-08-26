// Se usa la extensión .cjs porque package.json declara "type": "module":
// Babel debe poder cargar esta configuración de forma síncrona (Jest lo exige).
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
};
