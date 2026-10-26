// The canvas renders at a low "game pixel" resolution and CSS scales it up by an
// integer factor, which keeps the pixel art crisp at any window size.
export const view = { w: 640, h: 360, scale: 2 };

export function fitCanvas(game) {
    const scale = Math.max(1, Math.min(Math.round(window.innerHeight / 360), Math.floor(window.innerWidth / 300)));
    view.scale = scale;
    view.w = Math.ceil(window.innerWidth / scale);
    view.h = Math.ceil(window.innerHeight / scale);

    const canvas = game.canvas;
    canvas.width = view.w;
    canvas.height = view.h;
    canvas.style.width = `${view.w * scale}px`;
    canvas.style.height = `${view.h * scale}px`;
    // Resizing a canvas resets its context state.
    game.ctx.imageSmoothingEnabled = false;
}

// Distance from the view center to its corner: anything farther is off screen.
export const viewRadius = () => Math.hypot(view.w, view.h) / 2;
