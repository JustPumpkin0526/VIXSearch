// Per-tab client instance id helper — stores a UUID unique to the browser tab.
// Avoid external `uuid` dependency to keep build simple. Use `crypto.randomUUID()`
// when available, otherwise fallback to a simple RFC4122-like generator.

const STORAGE_KEY = 'vss.client.tab_id';

function generateUuid(): string {
  try {
    // @ts-ignore - crypto may be available in both browser and Node
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      // @ts-ignore
      return (crypto as any).randomUUID();
    }
  } catch {}

  // fallback: simple UUID v4-ish generator (not cryptographically strong)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateClientInstanceId(): string {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return generateUuid();
    }

    let id = window.sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUuid();
      window.sessionStorage.setItem(STORAGE_KEY, id);
    }

    return id;
  } catch (err) {
    return generateUuid();
  }
}

export default getOrCreateClientInstanceId;
