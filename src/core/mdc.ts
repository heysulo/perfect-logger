import { isNode } from '../utils/environment';

interface AsyncLocalStorageLike<T> {
    getStore(): T | undefined;
    run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R;
}

let asyncLocalStorageInstance: AsyncLocalStorageLike<Record<string, unknown>> | null = null;

if (isNode()) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const asyncHooks = require('async_hooks');
        if (asyncHooks && asyncHooks.AsyncLocalStorage) {
            asyncLocalStorageInstance = new asyncHooks.AsyncLocalStorage();
        }
    } catch {
        // Graceful fallback for restricted environments
    }
}

let fallbackStore: Record<string, unknown> = {};

/**
 * Mapped Diagnostic Context (MDC) modeled after Log4j ThreadContext / SLF4J MDC.
 * Provides automatic context propagation across asynchronous execution flows
 * via Node.js AsyncLocalStorage, with browser fallback.
 */
export class MDC {
    /**
     * Executes a function within an isolated MDC context.
     * Any logs written synchronously or asynchronously inside `fn` will automatically
     * include this context in their `LogEntry.context`.
     *
     * @param context Key-value pairs to attach to the async execution context.
     * @param fn The callback to execute.
     */
    public static run<T>(context: Record<string, unknown>, fn: () => T): T {
        if (asyncLocalStorageInstance) {
            const current = asyncLocalStorageInstance.getStore() || {};
            const merged = { ...current, ...context };
            return asyncLocalStorageInstance.run(merged, fn);
        }

        const prev = { ...fallbackStore };
        fallbackStore = { ...fallbackStore, ...context };
        try {
            return fn();
        } finally {
            fallbackStore = prev;
        }
    }

    /**
     * Sets a key-value pair in the current execution context.
     */
    public static put(key: string, value: unknown): void {
        if (asyncLocalStorageInstance) {
            const store = asyncLocalStorageInstance.getStore();
            if (store) {
                store[key] = value;
                return;
            }
        }
        fallbackStore[key] = value;
    }

    /**
     * Gets a value for a key from the current execution context.
     */
    public static get<T = unknown>(key: string): T | undefined {
        if (asyncLocalStorageInstance) {
            const store = asyncLocalStorageInstance.getStore();
            if (store) {
                return store[key] as T | undefined;
            }
        }
        return fallbackStore[key] as T | undefined;
    }

    /**
     * Removes a key from the current execution context.
     */
    public static remove(key: string): void {
        if (asyncLocalStorageInstance) {
            const store = asyncLocalStorageInstance.getStore();
            if (store) {
                delete store[key];
                return;
            }
        }
        delete fallbackStore[key];
    }

    /**
     * Clears all keys in the current execution context.
     */
    public static clear(): void {
        if (asyncLocalStorageInstance) {
            const store = asyncLocalStorageInstance.getStore();
            if (store) {
                for (const key of Object.keys(store)) {
                    delete store[key];
                }
                return;
            }
        }
        fallbackStore = {};
    }

    /**
     * Returns a snapshot copy of the current context.
     */
    public static getContext(): Record<string, unknown> {
        if (asyncLocalStorageInstance) {
            const store = asyncLocalStorageInstance.getStore();
            if (store) {
                return { ...store };
            }
        }
        return { ...fallbackStore };
    }

    /**
     * Internal testing hook to inspect or override underlying storage.
     */
    public static _setStorage(storage: unknown): void {
        asyncLocalStorageInstance = storage as AsyncLocalStorageLike<Record<string, unknown>> | null;
    }

    public static _getStorage(): unknown {
        return asyncLocalStorageInstance;
    }
}
