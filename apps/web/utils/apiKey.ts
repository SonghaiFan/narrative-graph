const KEY = 'ttng.openrouterApiKey';
const MODEL = 'ttng.model';

// The API key is kept in sessionStorage: it lasts as long as the tab and is never written to a file or the bundle.
// The model id is not secret, so it is remembered across visits. Storage can be missing or blocked, so every
// access is allowed to fail.
const read = (store: 'sessionStorage' | 'localStorage', name: string): string => {
    try {
        return (globalThis as any)[store]?.getItem(name) ?? '';
    } catch {
        return '';
    }
};

const write = (store: 'sessionStorage' | 'localStorage', name: string, value: string): void => {
    try {
        (globalThis as any)[store]?.setItem(name, value);
    } catch {
        // not remembered, which is fine
    }
};

export const loadApiKey = (): string => read('sessionStorage', KEY);
export const saveApiKey = (key: string): void => write('sessionStorage', KEY, key);
export const loadModel = (): string => read('localStorage', MODEL);
export const saveModel = (model: string): void => write('localStorage', MODEL, model);
