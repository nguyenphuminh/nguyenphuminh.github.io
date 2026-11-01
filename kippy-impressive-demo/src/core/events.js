// Tiny event bus: features talk through events instead of importing each other
export function createEvents() {
    const handlers = new Map();

    return {
        on(type, fn) {
            if (!handlers.has(type)) handlers.set(type, []);
            handlers.get(type).push(fn);
        },
        emit(type, data) {
            for (const fn of handlers.get(type) ?? []) fn(data);
        }
    };
}
