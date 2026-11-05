// Small UI helpers shared by scenes (screen space, 480×270).
import { drawText, measureText } from "../presentation/index.js";

export const COLORS = {
    text: "#e8e6f0",
    dim: "#8d88a6",
    gold: "#f2c46b",
    red: "#e0525e",
    cyan: "#6fe7ff",
    magenta: "#ff5fd2",
    panel: "rgba(10, 8, 20, 0.82)",
    border: "#4a4366",
};

export function drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** Vertical menu; the selected item is gold with a marker. */
export function drawMenu(ctx, items, selected, x, y, { align = "left", gap = 14, scale = 1 } = {}) {
    items.forEach((label, i) => {
        const active = i === selected;
        const text = active ? `> ${label}` : `  ${label}`;
        drawText(ctx, text, x, y + i * gap, { color: active ? COLORS.gold : COLORS.text, align, scale });
    });
}

export function wrapText(text, maxWidth, scale = 1) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (measureText(next, scale) > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

export function formatTime(seconds) {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Moves a menu selection with up/down and wraps around. */
export function navigate(menu, index, count, audio) {
    if (menu.up) {
        audio?.play("uiMove");
        return (index + count - 1) % count;
    }
    if (menu.down) {
        audio?.play("uiMove");
        return (index + 1) % count;
    }
    return index;
}
