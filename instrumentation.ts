export function register() {
  const storage = globalThis.localStorage as
    | {
        getItem?: (key: string) => string | null;
        setItem?: (key: string, value: string) => void;
        removeItem?: (key: string) => void;
        clear?: () => void;
      }
    | undefined;

  if (!storage || typeof storage.getItem === "function") return;

  const fallbackStore = new Map<string, string>();
  const fallbackStorage = {
    getItem: (key: string) => fallbackStore.get(String(key)) ?? null,
    setItem: (key: string, value: string) => {
      fallbackStore.set(String(key), String(value));
    },
    removeItem: (key: string) => {
      fallbackStore.delete(String(key));
    },
    clear: () => {
      fallbackStore.clear();
    }
  };

  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fallbackStorage
    });
  } catch {
    // Ignore if the runtime refuses to redefine; dev will keep the original error.
  }
}
