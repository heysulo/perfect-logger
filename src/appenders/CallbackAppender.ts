import { LogEntry, AppenderConfig } from '../core/types';
import { BaseAppender } from './BaseAppender';

export type LogCallback = (entry: LogEntry) => void;

export interface CallbackAppenderConfig extends AppenderConfig {
    callback: LogCallback;
}

export class CallbackAppender extends BaseAppender {
    private readonly callback: LogCallback;

    constructor(config: CallbackAppenderConfig) {
        super('CallbackAppender', config);
        if (typeof config.callback !== 'function') {
            throw new Error('CallbackAppender requires a `callback` function in its configuration.');
        }
        this.callback = config.callback;
    }

    public handle(entry: LogEntry): void {
        if (entry.level < this.minLevel) {
            return;
        }

        try {
            this.callback(entry);
        } catch (e) {
            console.error('Error executing callback in CallbackAppender:', e);
        }
    }

    public handleBatch(entries: LogEntry[]): void {
        for (const entry of entries) {
            this.handle(entry);
        }
    }
}
