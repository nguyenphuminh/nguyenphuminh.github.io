import { setMuted, isMuted } from "../../shared/audio.js";
import { loadSave, writeSave } from "../../shared/store.js";

// Keys that work on every screen.
export function handleGlobalKeys(input) {
    if (input.isKeyPressed("KeyM")) {
        setMuted(!isMuted());
        writeSave({ ...loadSave(), muted: isMuted() });
    }
}
