/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID() when available (requires secure context/HTTPS).
 * Falls back to Math.random() based generation for HTTP contexts.
 */
export function generateId(): string {
  // Use crypto.randomUUID if available (requires secure context)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Falls through to fallback
    }
  }

  // Fallback: manual UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
