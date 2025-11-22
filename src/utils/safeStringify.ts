/**
 * A safe version of JSON.stringify that handles circular references.
 * @param obj The object to stringify.
 * @returns A JSON string.
 */
export function safeStringify(obj: any): string {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                // Circular reference found, discard key
                return '[Circular]';
            }
            // Store value in our collection
            cache.add(value);
        }
        return value;
    });
}
