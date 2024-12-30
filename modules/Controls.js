

export function addControlListeners(game) {
  document.getElementById('left').addEventListener('click', () => game.movePiece(-1, 0));
  document.getElementById('right').addEventListener('click', () => game.movePiece(1, 0));
  document.getElementById('down').addEventListener('click', () => game.softDrop());
  document.getElementById('hardDrop').addEventListener('click', () => game.hardDrop());
  document.getElementById('rotate').addEventListener('click', () => game.rotatePiece());
}

export function removeControlListeners() {
  const buttons = ['left','right','down','hardDrop','rotate'];
  buttons.forEach(id => {
    const oldBtn = document.getElementById(id);
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  });
}
