// jest.setup.js
global.URL.createObjectURL = jest.fn(() => 'mockObjectURL');
const { createCanvas } = require('canvas');
global.HTMLCanvasElement.prototype.getContext = function () {
  return createCanvas().getContext('2d');
};
