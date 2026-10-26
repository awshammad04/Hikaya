/**
 * The guest passport, language, theme and narration settings all live in
 * localStorage. When a browser blocks storage ("block all cookies", some
 * embedded webviews) every access throws, and the first read would take the
 * whole app down. In that case an in-memory stand-in is installed: nothing
 * survives a reload, but every page works.
 */
export function ensureStorage() {
  try {
    const probe = "hikaya.storage-probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return;
  } catch {
    // Fall through to the in-memory stand-in.
  }
  const values = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
  try {
    Object.defineProperty(window, "localStorage", { configurable: true, value: memory });
  } catch {
    // Some engines refuse the override; individual reads still have fallbacks.
  }
}
