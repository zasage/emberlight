// Keyboard + mouse state, in logical canvas coordinates (1280x720).
// main.js converts raw client pixels via the letterbox scale and calls
// setMouseLogical(). The world only ever reads the plain `state` object,
// so the autopilot in shots.js can build an identical-shaped object.

export const state = {
  keys: new Set(), // e.g. 'KeyW', 'ArrowUp', 'Space', 'KeyP'
  mouseX: 640, // logical coords
  mouseY: 360,
  mouseDown: false,
  clicked: false, // set true on pointerdown, consumed by main.js each frame
  clickedX: 0,
  clickedY: 0,
};

export function attachInput(canvas, onFirstGesture) {
  let gestured = false;
  const gesture = () => {
    if (!gestured) {
      gestured = true;
      if (onFirstGesture) onFirstGesture();
    }
  };

  window.addEventListener('keydown', (e) => {
    gesture();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    state.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    state.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    state.keys.clear();
    state.mouseDown = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - r.left) / r.width) * 1280;
    state.mouseY = ((e.clientY - r.top) / r.height) * 720;
  });
  canvas.addEventListener('pointerdown', (e) => {
    gesture();
    const r = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - r.left) / r.width) * 1280;
    state.mouseY = ((e.clientY - r.top) / r.height) * 720;
    state.mouseDown = true;
    state.clicked = true;
    state.clickedX = state.mouseX;
    state.clickedY = state.mouseY;
  });
  window.addEventListener('pointerup', () => {
    state.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Normalised movement vector from WASD / arrow keys.
export function moveVector() {
  let x = 0;
  let y = 0;
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) x -= 1;
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) x += 1;
  if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) y -= 1;
  if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.hypot(x, y);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

export function pulsePressed() {
  return state.keys.has('Space') || state.mouseDown;
}

export function consumeClick() {
  if (!state.clicked) return null;
  state.clicked = false;
  return { x: state.clickedX, y: state.clickedY };
}

export function keyPressed(code) {
  return state.keys.has(code);
}
