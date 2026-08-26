// jest.setup.js
// Polyfill mínimo para jsdom. No usamos `jest` aquí porque los setupFiles se
// ejecutan antes de instalar el framework de test.
if (typeof global.URL.createObjectURL !== 'function') {
  global.URL.createObjectURL = () => 'mockObjectURL';
}
