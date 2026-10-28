const STORAGE_KEY = 'ttng.geminiApiKey';

// The key is kept in sessionStorage: it lasts as long as the tab and is never written to a file or the bundle.
// Storage can be missing or blocked, so every access is allowed to fail.
export const loadApiKey = (): string => {
    try {
        return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? '';
    } catch {
        return '';
    }
};

export const saveApiKey = (key: string): void => {
    try {
        globalThis.sessionStorage?.setItem(STORAGE_KEY, key);
    } catch {
        // not remembered, which is fine
    }
};
