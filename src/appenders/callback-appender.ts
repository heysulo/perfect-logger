import { LogEntry, AppenderConfig } from '../core/types';
import { BaseAppender } from './base-appender';

/**
 * Function signature for receiving raw LogEntry objects from CallbackAppender.
 */
export type LogCallback = (entry: LogEntry) => void;

/**
 * Configuration options for CallbackAppender.
 */
export interface CallbackAppenderConfig extends AppenderConfig {
    /** Callback invoked whenever a log entry passes filters and level checks */
    callback: LogCallback;
}

/**
 * Appender that forwards each processed LogEntry to a custom JavaScript function.
 * Ideal for bridging to external telemetry, in-memory buffers, or test assertions.
 *
 * @example
 * ```ts
 * const appender = new CallbackAppender({
 *   callback: (entry) => sendToAnalytics(entry),
 * });
 * ```
 */
export class CallbackAppender extends BaseAppender {
    private readonly callback: LogCallback;

    constructor(config: CallbackAppenderConfig) {
        super('CallbackAppender', config);
        if (typeof config.callback !== 'function') {
            throw new Error('CallbackAppender requires a `callback` function in its configuration.');
        }
        this.callback = config.callback;
    }

    /**
     * Forwards a single log entry to the configured callback.
     * @param entry The log entry to deliver.
     */
    public handle(entry: LogEntry): void {
        try {
            this.callback(entry);
        } catch (e) {
            console.error('Error executing callback in CallbackAppender:', e);
        }
    }

    /**
     * Forwards a batch of log entries sequentially to the callback.
     * @param entries Array of log entries to deliver.
     */
    public handleBatch(entries: LogEntry[]): void {
        for (const entry of entries) {
            this.handle(entry);
        }
    }
}
