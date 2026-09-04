/**
 * A safe version of JSON.stringify that handles circular references.
 * @param obj The object to stringify.
 * @param replacer A function that alters the behavior of the stringification process.
 * @param space A String or Number object that's used to insert white space into the output JSON string for readability purposes.
 * @returns A JSON string.
 */
export function safeStringify(
    obj: unknown,
    replacer?: ((key: string, value: unknown) => unknown) | null,
    space?: string | number
): string {
    const cache = new Set<unknown>();
    
    const combinedReplacer = (key: string, value: unknown): unknown => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return '[Circular]';
            }
            cache.add(value);
        }
        
        if (typeof replacer === 'function') {
            return replacer(key, value);
        }

        return value;
    };

    return JSON.stringify(obj, combinedReplacer as (key: string, value: unknown) => unknown, space);
}
