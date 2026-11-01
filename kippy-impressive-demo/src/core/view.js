// Helpers around Kippy's camera, whose position is the top-left of the view
// and which zooms/rotates around the canvas center.

// World units visible vertically at zoom factor 1, regardless of screen size
export const VIEW_HEIGHT = 820;

export const baseZoom = (canvas) => canvas.height / VIEW_HEIGHT;

export function centerCamera(camera, canvas, x, y) {
    camera.position.x = x - canvas.width / 2 / camera.zoom;
    camera.position.y = y - canvas.height / 2 / camera.zoom;
}

export function cameraCenter(camera, canvas) {
    return {
        x: camera.position.x + canvas.width / 2 / camera.zoom,
        y: camera.position.y + canvas.height / 2 / camera.zoom
    };
}

// Same transform as Camera.apply(), but for any context (e.g. a half-res light buffer)
export function applyCamera(ctx, camera, canvas, scale = 1) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const z = camera.zoom;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.translate(cx, cy);
    ctx.scale(z, z);
    ctx.rotate(camera.rotation);
    ctx.translate(-camera.position.x - cx / z, -camera.position.y - cy / z);
}

export function worldToScreen(camera, canvas, x, y) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const z = camera.zoom;
    const dx = (x - camera.position.x - cx / z) * z;
    const dy = (y - camera.position.y - cy / z) * z;
    const cos = Math.cos(camera.rotation);
    const sin = Math.sin(camera.rotation);

    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// World-space box that covers the view (rotation-safe)
export function viewBounds(camera, canvas, margin = 0) {
    const c = cameraCenter(camera, canvas);
    const half = Math.hypot(canvas.width, canvas.height) / 2 / camera.zoom;
    const hw = camera.rotation === 0 ? canvas.width / 2 / camera.zoom : half;
    const hh = camera.rotation === 0 ? canvas.height / 2 / camera.zoom : half;

    return {
        x0: c.x - hw - margin,
        y0: c.y - hh - margin,
        x1: c.x + hw + margin,
        y1: c.y + hh + margin
    };
}

export const inBounds = (b, x, y, r = 0) => x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1;
